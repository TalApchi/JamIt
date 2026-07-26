import {
  AudioPlayer,
  createAudioPlayer,
  setAudioModeAsync
} from "expo-audio";
import { ResolvedSample, SampleResolver } from "./sampleTypes";

export type ActiveSoundId = string;

export type PlayableNote = {
  key: string;
  scaleName: string;
  padIndex: number;
  noteWithOctave: string;
  midi: number;
};

export type AudioNoteDebugInfo = ResolvedSample & PlayableNote;

type LoadedNote = {
  note: PlayableNote;
  sample: ResolvedSample;
  // A single persistent player per note (matching the pattern already
  // proven reliable for every note). Round-robin takes are NOT given one
  // player each: creating one native player per take (up to ~7 for a
  // heavily-round-robined note) meant a single scale change could spin up
  // dozens of concurrent native players all downloading at once, which made
  // playback unreliable (delayed or silently-dropped note-ons) under that
  // load. Cycling `sample.sources` via `player.replace()` on one player
  // keeps exactly one native player alive per note regardless of how many
  // round-robin takes it has.
  player: AudioPlayer;
  // Index into `sample.sources`/`sample.sourceFilenames` currently loaded
  // into `player`. Round-robin: each true note-on (the 0 -> 1
  // activeTouchCount transition) advances to the next source and
  // replace()s the player's item, cycling back to 0 after the last.
  activeSourceIndex: number;
  // Number of touches currently holding this note. The note starts on the
  // 0 -> 1 transition and stops on the 1 -> 0 transition, so a second finger
  // on the same hole never retriggers and never cuts the first finger off.
  activeTouchCount: number;
  // Bumped on every note-on to cancel an in-flight release fade.
  generation: number;
  // Retry timer for re-applying rate/pitch config over a short window after
  // every note-on (see ensurePitchConfig).
  configRetryTimer?: ReturnType<typeof setTimeout>;
};

const RELEASE_FADE_STEPS = 3;
const RELEASE_FADE_STEP_MS = 9;
// How long/hard to keep reasserting rate/pitch config after every note-on
// (see ensurePitchConfig). 6 attempts x 60ms = 360ms of coverage past the
// point playback actually starts.
const PITCH_REASSERT_ATTEMPTS = 6;
const PITCH_REASSERT_INTERVAL_MS = 60;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class AudioEngine {
  private readonly notes = new Map<string, LoadedNote>();
  private readonly activeTouches = new Map<ActiveSoundId, string>();
  private isReady = false;

  constructor(private readonly resolveSample: SampleResolver) {}

  async preload() {
    if (this.isReady) return;

    await setAudioModeAsync({
      allowsRecording: false,
      interruptionMode: "doNotMix",
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false
    });

    this.isReady = true;
  }

  // Creates one player per scale degree up front (first press must not pay
  // the load cost) and drops players from previous scales.
  async prepareScale(notes: PlayableNote[]) {
    await this.preload();

    const wantedKeys = new Set(notes.map((note) => note.key));
    [...this.notes.entries()].forEach(([key, loaded]) => {
      if (wantedKeys.has(key)) return;
      this.disposeNote(loaded);
      this.notes.delete(key);
    });

    notes.forEach((note) => {
      if (!this.notes.has(note.key)) {
        this.loadNote(note);
      }
    });
  }

  getDebugInfo(note: PlayableNote): AudioNoteDebugInfo {
    const sample = this.resolveSample(note.midi);
    return {
      ...sample,
      ...note
    };
  }

  async play(id: ActiveSoundId, note: PlayableNote) {
    await this.preload();

    const currentKey = this.activeTouches.get(id);
    if (currentKey === note.key) return;
    if (currentKey) {
      // Bookkeeping runs synchronously; the release fade continues in the
      // background so a slide starts the new note without waiting on it.
      this.stop(id).catch(() => undefined);
    }

    const loaded = this.notes.get(note.key) ?? this.loadNote(note);
    this.activeTouches.set(id, note.key);
    loaded.activeTouchCount += 1;
    if (loaded.activeTouchCount > 1) return;

    loaded.generation += 1;

    // Round-robin: swap the player's source only when there is more than
    // one take (the Flute always has exactly one, so this never runs a
    // no-op replace() on it).
    if (loaded.sample.sources.length > 1) {
      loaded.activeSourceIndex = (loaded.activeSourceIndex + 1) % loaded.sample.sources.length;
      loaded.player.replace(loaded.sample.sources[loaded.activeSourceIndex]);
    }

    loaded.player.volume = loaded.sample.volume;
    // Applied once now — this is NOT just a hedge: expo-audio's native
    // play() reads back whatever rate this call last stored (there is no
    // separate "rate to start at" argument), so skipping this would start
    // every note at the wrong rate for at least one frame. Applied AGAIN
    // right after seekTo(0) resolves, because expo-audio exposes no direct
    // signal for "the native player item has finished its own internal
    // readiness transition" (relevant on a brand new item from
    // replace()/createAudioPlayer) — a resolved seek is the best available
    // proxy, since seeking requires the item to already know its own
    // timing. Setting the pitch ALGORITHM (as opposed to the rate value)
    // before that transition completes is not reliable — iOS can silently
    // reset AVPlayerItem.audioTimePitchAlgorithm back to its own
    // pitch-CORRECTING default during that transition, which is invisible
    // to `isLoaded` and to `shouldCorrectPitch` (a JS-side echo of what we
    // last requested, not a live read of the native item) alike. The result
    // when it happens: the sample genuinely plays at the different rate
    // (confirmed by a live rate read in verifyAppliedConfig below) while
    // iOS cancels out the resulting pitch shift — two different logged
    // rates sounding identical.
    this.applyPitchConfig(loaded);
    await loaded.player.seekTo(0);
    this.applyPitchConfig(loaded);
    loaded.player.play();

    // Keep reasserting for a short window after playback starts regardless
    // of `isLoaded` — that flag turning true does not guarantee the pitch
    // algorithm survived the item's readiness transition, so this is not
    // conditioned on it the way it used to be.
    this.ensurePitchConfig(loaded);
    this.verifyAppliedConfig(loaded);
  }

  async stop(id: ActiveSoundId) {
    const key = this.activeTouches.get(id);
    if (!key) return;
    this.activeTouches.delete(id);

    const loaded = this.notes.get(key);
    if (!loaded) return;

    loaded.activeTouchCount = Math.max(0, loaded.activeTouchCount - 1);
    if (loaded.activeTouchCount > 0) return;

    await this.fadeOutAndPause(loaded);
  }

  // Like stop(), but never fades/pauses the player: the note keeps sounding
  // and is left to finish on its own (its own natural decay/end-of-file),
  // exactly like a real plucked instrument where lifting your finger does
  // not silence a tine that's already ringing. Still detaches this touch
  // from AudioEngine's own bookkeeping — `activeTouches`/`activeTouchCount`
  // — so a later, unrelated touch reusing the same id (native touch
  // identifiers can be recycled once a touch sequence ends) is treated as a
  // fresh press, and re-pressing the SAME pad before the ring finishes still
  // correctly retriggers it (activeTouchCount 0 -> 1 again).
  release(id: ActiveSoundId) {
    const key = this.activeTouches.get(id);
    if (!key) return;
    this.activeTouches.delete(id);

    const loaded = this.notes.get(key);
    if (!loaded) return;

    loaded.activeTouchCount = Math.max(0, loaded.activeTouchCount - 1);
  }

  async stopAll() {
    const activeIds = [...this.activeTouches.keys()];
    await Promise.all(activeIds.map((id) => this.stop(id)));
  }

  async unload() {
    await this.stopAll();
    [...this.notes.values()].forEach((loaded) => this.disposeNote(loaded));
    this.notes.clear();
    this.isReady = false;
  }

  private disposeNote(loaded: LoadedNote) {
    if (loaded.configRetryTimer) clearTimeout(loaded.configRetryTimer);
    loaded.player.remove();
  }

  // Rate and pitch mode must hold on every platform quirk: expo-audio's
  // `replace()` after downloadFirst discards them (web rebuilds the media
  // element; iOS creates a new AVPlayerItem whose pitch algorithm defaults to
  // pitch-CORRECTING; Android defaults preservesPitch=true). If they are
  // lost, the pad plays the raw source pitch — which makes pads sharing a
  // source sound identical and breaks adjacent intervals.
  private applyPitchConfig(loaded: LoadedNote) {
    loaded.player.loop = false;
    loaded.player.shouldCorrectPitch = false;
    loaded.player.setPlaybackRate(loaded.sample.playbackRate);
  }

  // Re-applies the config a fixed number of times over a short window,
  // regardless of `isLoaded`. This deliberately does NOT stop as soon as
  // `isLoaded` turns true: that flag can turn true while the pitch
  // algorithm has already been (or is about to be) silently reset by iOS
  // during the item's own readiness transition, so "loaded" is not a
  // trustworthy stopping signal for this specific setting.
  //
  // `generation` is captured once (from the current value at the first
  // call, either loadNote's preload or play()'s note-on) and compared on
  // every retry: if the note has moved on since — released (fadeOutAndPause
  // bumps generation) or retriggered (play() bumps it again and starts its
  // own fresh chain) — this stale chain stops instead of continuing to burn
  // bridge calls on behalf of an epoch that no longer matters.
  private ensurePitchConfig(loaded: LoadedNote, attempt = 0, generation: number = loaded.generation) {
    if (this.notes.get(loaded.note.key) !== loaded) return;
    if (loaded.generation !== generation) return;

    this.applyPitchConfig(loaded);
    if (attempt >= PITCH_REASSERT_ATTEMPTS) return;

    if (loaded.configRetryTimer) clearTimeout(loaded.configRetryTimer);
    loaded.configRetryTimer = setTimeout(
      () => this.ensurePitchConfig(loaded, attempt + 1, generation),
      PITCH_REASSERT_INTERVAL_MS
    );
  }

  // Debug evidence for every note-on: logs the rate/pitch mode the player is
  // ACTUALLY using shortly after the note starts, and heals any mismatch.
  private verifyAppliedConfig(loaded: LoadedNote) {
    const generation = loaded.generation;
    setTimeout(() => {
      if (loaded.generation !== generation || this.notes.get(loaded.note.key) !== loaded) return;

      const intended = loaded.sample.playbackRate;
      // `applied` is a genuine live read (backed by the native player's
      // actual rate). `pitchCorrection` is NOT: expo-audio only echoes back
      // the value we last set, not the live native audioTimePitchAlgorithm,
      // so this can read `false` (our own request) even if iOS silently
      // reset the real pitch algorithm — that mismatch is exactly the bug
      // ensurePitchConfig's unconditional reassertion window defends
      // against, but it is real and this log cannot detect it directly.
      const applied = loaded.player.playbackRate;
      const pitchCorrection = loaded.player.shouldCorrectPitch;
      const ok = Math.abs(applied - intended) < 0.005 && !pitchCorrection;
      console.log(
        [
          "[AudioEngine verify]",
          `pad=${loaded.note.padIndex}`,
          `target=${loaded.note.noteWithOctave}`,
          `source=${loaded.sample.sourceFilenames[loaded.activeSourceIndex]}`,
          `intendedRate=${intended.toFixed(4)}`,
          `appliedRate=${applied.toFixed(4)}`,
          `pitchCorrection=${pitchCorrection}`,
          `loaded=${loaded.player.isLoaded}`,
          ok ? "OK" : "MISMATCH -> re-applying"
        ].join(" ")
      );
      if (!ok) {
        this.ensurePitchConfig(loaded);
      }
    }, 150);
  }

  // Short volume ramp before pausing so releases do not click.
  private async fadeOutAndPause(loaded: LoadedNote) {
    const generation = ++loaded.generation;
    const startVolume = loaded.sample.volume;

    for (let step = 1; step <= RELEASE_FADE_STEPS; step++) {
      loaded.player.volume = startVolume * (1 - step / RELEASE_FADE_STEPS);
      await delay(RELEASE_FADE_STEP_MS);
      if (loaded.generation !== generation) return;
    }

    loaded.player.pause();
    await loaded.player.seekTo(0);
    if (loaded.generation === generation) {
      loaded.player.volume = startVolume;
    }
  }

  private loadNote(note: PlayableNote) {
    const sample = this.resolveSample(note.midi);
    const player = createAudioPlayer(sample.sources[0], {
      downloadFirst: true,
      keepAudioSessionActive: true,
      updateInterval: 100
    });
    player.volume = sample.volume;

    const loaded: LoadedNote = {
      note,
      sample,
      player,
      activeSourceIndex: 0,
      activeTouchCount: 0,
      generation: 0
    };
    this.notes.set(note.key, loaded);
    // Never loop (looping replays the breath/pluck attack = fake retrigger),
    // never pitch-correct; re-applied until the source finishes loading
    // because downloadFirst/replace() resets these on some platforms.
    this.ensurePitchConfig(loaded);
    return loaded;
  }
}
