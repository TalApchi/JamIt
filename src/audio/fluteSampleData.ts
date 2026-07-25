// Pure data + resolution logic for the bamboo flute sample kit.
// Kept free of require()/expo imports so node test scripts can exercise it.
//
// The kit has an EXACT sample for every playable note (MIDI 60..82 = C4..A#5):
//  - 9 original "FluteClean2" recordings (in tune within +-3 cents; their
//    FILENAMES are two octaves below the actual sounding pitch, e.g.
//    FluteClean2_C2.wav sounds C4 / MIDI 60).
//  - 15 files in generated/ pre-rendered by scripts/generate-shifted-samples.js
//    (offline Lanczos resampling of the nearest original, pitch-verified to
//    +-3 cents). Pre-rendering exists because runtime pitch shifting proved
//    unreliable on iOS (AVPlayerItem.audioTimePitchAlgorithm is not
//    verifiable from JS and did not reliably apply), which made shifted holes
//    sound at the raw source pitch.
// Every note therefore plays at playbackRate 1.0; the nearest-sample +
// rate = 2^(shift/12) resolver only ever engages for targets outside 60..82.
// `gain` normalizes each file's sustained RMS (generated files inherit their
// source's gain, since resampling preserves amplitude).

export type FluteSampleDef = {
  filename: string;
  noteWithOctave: string;
  midi: number;
  gain: number;
};

export const FLUTE_SAMPLE_DEFS: FluteSampleDef[] = [
  { filename: "FluteClean2_C2.wav", noteWithOctave: "C4", midi: 60, gain: 0.881 },
  { filename: "generated/Flute_C#4.wav", noteWithOctave: "C#4", midi: 61, gain: 0.881 },
  { filename: "generated/Flute_D4.wav", noteWithOctave: "D4", midi: 62, gain: 0.933 },
  { filename: "FluteClean2_D#2.wav", noteWithOctave: "D#4", midi: 63, gain: 0.933 },
  { filename: "generated/Flute_E4.wav", noteWithOctave: "E4", midi: 64, gain: 0.933 },
  { filename: "generated/Flute_F4.wav", noteWithOctave: "F4", midi: 65, gain: 0.902 },
  { filename: "FluteClean2_F#2.wav", noteWithOctave: "F#4", midi: 66, gain: 0.902 },
  { filename: "generated/Flute_G4.wav", noteWithOctave: "G4", midi: 67, gain: 0.902 },
  { filename: "generated/Flute_G#4.wav", noteWithOctave: "G#4", midi: 68, gain: 0.989 },
  { filename: "FluteClean2_A2.wav", noteWithOctave: "A4", midi: 69, gain: 0.989 },
  { filename: "generated/Flute_A#4.wav", noteWithOctave: "A#4", midi: 70, gain: 0.989 },
  { filename: "generated/Flute_B4.wav", noteWithOctave: "B4", midi: 71, gain: 0.871 },
  { filename: "FluteClean2_C3.wav", noteWithOctave: "C5", midi: 72, gain: 0.871 },
  { filename: "generated/Flute_C#5.wav", noteWithOctave: "C#5", midi: 73, gain: 0.871 },
  { filename: "generated/Flute_D5.wav", noteWithOctave: "D5", midi: 74, gain: 0.832 },
  { filename: "FluteClean2_D#3.wav", noteWithOctave: "D#5", midi: 75, gain: 0.832 },
  { filename: "generated/Flute_E5.wav", noteWithOctave: "E5", midi: 76, gain: 0.832 },
  { filename: "generated/Flute_F5.wav", noteWithOctave: "F5", midi: 77, gain: 0.891 },
  { filename: "FluteClean2_F#3.wav", noteWithOctave: "F#5", midi: 78, gain: 0.891 },
  { filename: "generated/Flute_G5.wav", noteWithOctave: "G5", midi: 79, gain: 0.891 },
  { filename: "generated/Flute_G#5.wav", noteWithOctave: "G#5", midi: 80, gain: 1.0 },
  { filename: "FluteClean2_A3.wav", noteWithOctave: "A5", midi: 81, gain: 1.0 },
  { filename: "generated/Flute_A#5.wav", noteWithOctave: "A#5", midi: 82, gain: 1.0 },
  { filename: "FluteClean2_C4.wav", noteWithOctave: "C6", midi: 84, gain: 0.871 }
];

export type ResolvedFluteSampleDef = {
  targetMidi: number;
  def: FluteSampleDef;
  semitoneShift: number;
  playbackRate: number;
};

export function getPlaybackRate(semitoneShift: number) {
  return Math.pow(2, semitoneShift / 12);
}

// Nearest source by full MIDI distance (octave-aware, never by pitch class).
// Playable targets always hit an exact sample (shift 0, rate 1.0).
export function resolveFluteSampleDef(targetMidi: number): ResolvedFluteSampleDef {
  const def = FLUTE_SAMPLE_DEFS.reduce((best, sample) => {
    const bestDistance = Math.abs(targetMidi - best.midi);
    const sampleDistance = Math.abs(targetMidi - sample.midi);
    return sampleDistance < bestDistance ? sample : best;
  });
  const semitoneShift = targetMidi - def.midi;

  return {
    targetMidi,
    def,
    semitoneShift,
    playbackRate: getPlaybackRate(semitoneShift)
  };
}
