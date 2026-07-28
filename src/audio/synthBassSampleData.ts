// Pure data + resolution logic for the Synth Bass sample kit.
// Kept free of require()/expo imports so node test scripts can exercise it.
//
// The kit has an EXACT, dedicated, pre-rendered sample for every playable
// note (MIDI 60..82 = C4..A#5 -- the same range the Flute/Kalimba/Melodica
// kits cover, since it's exactly the range every supported Major/Natural
// Minor scale can ever target):
//  - 6 notes (C4, E4, G#4, C5, E5, G#5) are the pack's own real recorded
//    takes, used directly from `assets/audio/SynthBass1/`.
//  - 17 notes have no matching recording and are pre-rendered offline into
//    `generated/` by scripts/generate-synthbass-shifted-samples.js, by
//    resampling the nearest recorded C/E/G# take (Lanczos kernel, same
//    technique as the Flute's/Kalimba's/Melodica's own generated/ files).
//    Pre-rendering was used from the start here (not attempted at runtime
//    first) because runtime playbackRate-based pitch shifting was already
//    confirmed UNRELIABLE on-device for the Melodica/Piano (see
//    melodicaSampleData.ts's own history) -- the same underlying
//    expo-audio/OS behavior applies to every instrument in this app, so
//    there was no reason to re-discover it here. Every note therefore plays
//    at playbackRate 1.0; the nearest-sample + rate = 2^(shift/12) resolver
//    only ever engages for targets outside 60..82, which the scale engine
//    can never produce.
// `gain` normalizes each file's sustained RMS; left at 1.0 for now (no RMS
// analysis pass yet), same starting point as the Kalimba/Melodica.
export type SynthBassSampleDef = {
  filename: string;
  noteWithOctave: string;
  midi: number;
  gain: number;
};

export const SYNTH_BASS_SAMPLE_DEFS: SynthBassSampleDef[] = [
  { filename: "C4.wav", noteWithOctave: "C4", midi: 60, gain: 1.0 },
  { filename: "generated/SynthBass_C#4.wav", noteWithOctave: "C#4", midi: 61, gain: 1.0 },
  { filename: "generated/SynthBass_D4.wav", noteWithOctave: "D4", midi: 62, gain: 1.0 },
  { filename: "generated/SynthBass_D#4.wav", noteWithOctave: "D#4", midi: 63, gain: 1.0 },
  { filename: "E4.wav", noteWithOctave: "E4", midi: 64, gain: 1.0 },
  { filename: "generated/SynthBass_F4.wav", noteWithOctave: "F4", midi: 65, gain: 1.0 },
  { filename: "generated/SynthBass_F#4.wav", noteWithOctave: "F#4", midi: 66, gain: 1.0 },
  { filename: "generated/SynthBass_G4.wav", noteWithOctave: "G4", midi: 67, gain: 1.0 },
  { filename: "G#4.wav", noteWithOctave: "G#4", midi: 68, gain: 1.0 },
  { filename: "generated/SynthBass_A4.wav", noteWithOctave: "A4", midi: 69, gain: 1.0 },
  { filename: "generated/SynthBass_A#4.wav", noteWithOctave: "A#4", midi: 70, gain: 1.0 },
  { filename: "generated/SynthBass_B4.wav", noteWithOctave: "B4", midi: 71, gain: 1.0 },
  { filename: "C5.wav", noteWithOctave: "C5", midi: 72, gain: 1.0 },
  { filename: "generated/SynthBass_C#5.wav", noteWithOctave: "C#5", midi: 73, gain: 1.0 },
  { filename: "generated/SynthBass_D5.wav", noteWithOctave: "D5", midi: 74, gain: 1.0 },
  { filename: "generated/SynthBass_D#5.wav", noteWithOctave: "D#5", midi: 75, gain: 1.0 },
  { filename: "E5.wav", noteWithOctave: "E5", midi: 76, gain: 1.0 },
  { filename: "generated/SynthBass_F5.wav", noteWithOctave: "F5", midi: 77, gain: 1.0 },
  { filename: "generated/SynthBass_F#5.wav", noteWithOctave: "F#5", midi: 78, gain: 1.0 },
  { filename: "generated/SynthBass_G5.wav", noteWithOctave: "G5", midi: 79, gain: 1.0 },
  { filename: "G#5.wav", noteWithOctave: "G#5", midi: 80, gain: 1.0 },
  { filename: "generated/SynthBass_A5.wav", noteWithOctave: "A5", midi: 81, gain: 1.0 },
  { filename: "generated/SynthBass_A#5.wav", noteWithOctave: "A#5", midi: 82, gain: 1.0 }
];

export type ResolvedSynthBassSampleDef = {
  targetMidi: number;
  def: SynthBassSampleDef;
  semitoneShift: number;
  playbackRate: number;
};

export function getSynthBassPlaybackRate(semitoneShift: number) {
  return Math.pow(2, semitoneShift / 12);
}

// Nearest def by full MIDI distance (octave-aware, never by pitch class).
// Playable targets (60..82, i.e. every note any supported scale can
// produce) always hit an exact def: shift 0, rate 1.0. This fallback only
// engages for a target outside that range, which cannot happen given the
// scale engine's own root/interval bounds -- kept only as the same
// defensive fallback every other instrument's sample data module has.
export function resolveSynthBassSampleDef(targetMidi: number): ResolvedSynthBassSampleDef {
  const def = SYNTH_BASS_SAMPLE_DEFS.reduce((best, sample) => {
    const bestDistance = Math.abs(targetMidi - best.midi);
    const sampleDistance = Math.abs(targetMidi - sample.midi);
    return sampleDistance < bestDistance ? sample : best;
  });
  const semitoneShift = targetMidi - def.midi;

  return {
    targetMidi,
    def,
    semitoneShift,
    playbackRate: getSynthBassPlaybackRate(semitoneShift)
  };
}
