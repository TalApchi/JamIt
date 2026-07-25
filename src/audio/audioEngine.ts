import {
  AudioPlayer,
  createAudioPlayer,
  setAudioModeAsync
} from "expo-audio";
import { ResolvedFluteSample, resolveFluteSample } from "./fluteSamples";

export type ActiveSoundId = string;

export type PlayableNote = {
  key: string;
  scaleName: string;
  holeIndex: number;
  noteWithOctave: string;
  midi: number;
};

export type AudioNoteDebugInfo = ResolvedFluteSample & PlayableNote;

type LoadedNote = {
  note: PlayableNote;
  sample: ResolvedFluteSample;
  player: AudioPlayer;
  // Number of touches currently holding this note. The note starts on the
  // 0 -> 1 transition and stops on the 1 -> 0 transition, so a second finger
  // on the same hole never retriggers and never cuts the first finger off.
  activeTouchCount: number;
  // Bumped on every note-on to cancel an in-flight release fade.
  generation: number;
  // Retry timer for re-applying rate/pitch config until the source is loaded.
  configRetryTimer?: ReturnType<typeof setTimeout>;
};

const RELEASE_FADE_STEPS = 3;
const RELEASE_FADE_STEP_MS = 9;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class AudioEngine {
  private readonly notes = new Map<string, LoadedNote>();
  private readonly activeTouches = new Map<ActiveSoundId, string>();
  private isReady = false;

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

  // Creates players for every note of the current scale up front (first press
  // must not pay the load cost) and drops players from previous scales.
  async prepareScale(notes: PlayableNote[]) {
    await this.preload();

    const wantedKeys = new Set(notes.map((note) => note.key));
    [...this.notes.entries()].forEach(([key, loaded]) => {
      if (wantedKeys.has(key)) return;
      if (loaded.configRetryTimer) clearTimeout(loaded.configRetryTimer);
      loaded.player.remove();
      this.notes.delete(key);
    });

    notes.forEach((note) => {
      if (!this.notes.has(note.key)) {
        this.loadNote(note);
      }
    });
  }

  getDebugInfo(note: PlayableNote): AudioNoteDebugInfo {
    const sample = resolveFluteSample(note.midi);
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
    loaded.player.volume = loaded.sample.volume;
    this.applyPitchConfig(loaded);
    await loaded.player.seekTo(0);
    loaded.player.play();

    // If the source is still loading (first press right after a scale
    // change), the rate/pitch config applied above may have landed on a
    // player item that does not exist yet; keep re-applying until loaded.
    if (!loaded.player.isLoaded) {
      this.ensurePitchConfig(loaded);
    }
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

  async stopAll() {
    const activeIds = [...this.activeTouches.keys()];
    await Promise.all(activeIds.map((id) => this.stop(id)));
  }

  async unload() {
    await this.stopAll();
    [...this.notes.values()].forEach((loaded) => {
      if (loaded.configRetryTimer) clearTimeout(loaded.configRetryTimer);
      loaded.player.remove();
    });
    this.notes.clear();
    this.isReady = false;
  }

  // Rate and pitch mode must hold on every platform quirk: expo-audio's
  // `replace()` after downloadFirst discards them (web rebuilds the media
  // element; iOS creates a new AVPlayerItem whose pitch algorithm defaults to
  // pitch-CORRECTING; Android defaults preservesPitch=true). If they are
  // lost, the hole plays the raw source pitch — which makes holes sharing a
  // source sound identical and breaks adjacent intervals.
  private applyPitchConfig(loaded: LoadedNote) {
    loaded.player.loop = false;
    loaded.player.shouldCorrectPitch = false;
    loaded.player.setPlaybackRate(loaded.sample.playbackRate);
  }

  // Re-applies the config until the player reports its source as loaded, so
  // the settings are guaranteed to land on the final player item.
  private ensurePitchConfig(loaded: LoadedNote, attempt = 0) {
    if (this.notes.get(loaded.note.key) !== loaded) return;

    this.applyPitchConfig(loaded);
    if (loaded.player.isLoaded || attempt >= 20) return;

    if (loaded.configRetryTimer) clearTimeout(loaded.configRetryTimer);
    loaded.configRetryTimer = setTimeout(() => this.ensurePitchConfig(loaded, attempt + 1), 150);
  }

  // Debug evidence for every note-on: logs the rate/pitch mode the player is
  // ACTUALLY using shortly after the note starts, and heals any mismatch.
  private verifyAppliedConfig(loaded: LoadedNote) {
    const generation = loaded.generation;
    setTimeout(() => {
      if (loaded.generation !== generation || this.notes.get(loaded.note.key) !== loaded) return;

      const intended = loaded.sample.playbackRate;
      const applied = loaded.player.playbackRate;
      const pitchCorrection = loaded.player.shouldCorrectPitch;
      const ok = Math.abs(applied - intended) < 0.005 && !pitchCorrection;
      console.log(
        [
          "[AudioEngine verify]",
          `hole=${loaded.note.holeIndex}`,
          `target=${loaded.note.noteWithOctave}`,
          `source=${loaded.sample.sourceFilename}`,
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
    const sample = resolveFluteSample(note.midi);
    const player = createAudioPlayer(sample.source, {
      downloadFirst: true,
      keepAudioSessionActive: true,
      updateInterval: 100
    });
    player.volume = sample.volume;

    const loaded: LoadedNote = {
      note,
      sample,
      player,
      activeTouchCount: 0,
      generation: 0
    };
    this.notes.set(note.key, loaded);
    // Never loop (looping replays the breath attack = fake retrigger), never
    // pitch-correct; re-applied until the source finishes loading because
    // replace() resets these on some platforms.
    this.ensurePitchConfig(loaded);
    return loaded;
  }
}
