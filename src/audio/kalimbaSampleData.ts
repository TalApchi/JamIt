// Pure data + resolution logic for the Kalimba sample kit.
// Kept free of require()/expo imports so node test scripts can exercise it.
//
// The kit has an EXACT, dedicated, pre-rendered sample for every playable
// note (MIDI 60..82 = C4..A#5 -- the same range the Flute's own kit
// covers, since it's exactly the range every supported Major/Natural Minor
// scale can ever target):
//  - 7 notes (C4, D#4, E4, G4, G#4, C5, C#5) are the Kalimba's own real,
//    recorded tines, used directly from `samples/`.
//  - 16 notes have no matching tine and are pre-rendered offline into
//    `generated/` by scripts/generate-kalimba-shifted-samples.js, by
//    resampling every round-robin take of the nearest real tine (Lanczos
//    kernel, same technique as the Flute's own generated/ files) and
//    verifying the actual rendered pitch of every resulting file (see that
//    script's own pitch-verification pass, and this file's own mapping
//    test). This exists because runtime playbackRate-based pitch shifting
//    was confirmed UNRELIABLE on-device: the Audio Debug screen showed
//    several different logged playbackRate values producing IDENTICAL
//    audible pitch (iOS silently not applying the pitch-shift algorithm
//    reliably). Every note therefore plays at playbackRate 1.0; the
//    nearest-sample + rate = 2^(shift/12) resolver only ever engages for
//    targets outside 60..82, exactly mirroring fluteSampleData.ts's own
//    design and the same reason it exists there.
// `gain` normalizes each file's sustained RMS; left at 1.0 for now (no RMS
// analysis pass yet), same starting point as when the Kalimba first shipped.
export type KalimbaSampleDef = {
  filenames: string[];
  noteWithOctave: string;
  midi: number;
  gain: number;
};

export const KALIMBA_SAMPLE_DEFS: KalimbaSampleDef[] = [
  { filenames: ["samples/1_01.wav", "samples/1_02.wav", "samples/1_03.wav", "samples/1_04.wav", "samples/1_05.wav"], noteWithOctave: "C4", midi: 60, gain: 1.0 },
  { filenames: ["generated/Kalimba_C#4_01.wav", "generated/Kalimba_C#4_02.wav", "generated/Kalimba_C#4_03.wav", "generated/Kalimba_C#4_04.wav", "generated/Kalimba_C#4_05.wav"], noteWithOctave: "C#4", midi: 61, gain: 1.0 },
  { filenames: ["generated/Kalimba_D4_01.wav", "generated/Kalimba_D4_02.wav", "generated/Kalimba_D4_03.wav", "generated/Kalimba_D4_04.wav", "generated/Kalimba_D4_05.wav"], noteWithOctave: "D4", midi: 62, gain: 1.0 },
  { filenames: ["samples/2_01.wav", "samples/2_02.wav", "samples/2_03.wav", "samples/2_04.wav", "samples/2_05.wav"], noteWithOctave: "D#4", midi: 63, gain: 1.0 },
  { filenames: ["samples/3_01.wav", "samples/3_02.wav", "samples/3_03.wav", "samples/3_04.wav", "samples/3_05.wav", "samples/3_06.wav", "samples/3_07.wav"], noteWithOctave: "E4", midi: 64, gain: 1.0 },
  { filenames: ["generated/Kalimba_F4_01.wav", "generated/Kalimba_F4_02.wav", "generated/Kalimba_F4_03.wav", "generated/Kalimba_F4_04.wav", "generated/Kalimba_F4_05.wav", "generated/Kalimba_F4_06.wav", "generated/Kalimba_F4_07.wav"], noteWithOctave: "F4", midi: 65, gain: 1.0 },
  { filenames: ["generated/Kalimba_F#4_01.wav", "generated/Kalimba_F#4_02.wav", "generated/Kalimba_F#4_03.wav", "generated/Kalimba_F#4_04.wav", "generated/Kalimba_F#4_05.wav", "generated/Kalimba_F#4_06.wav", "generated/Kalimba_F#4_07.wav"], noteWithOctave: "F#4", midi: 66, gain: 1.0 },
  { filenames: ["samples/4_01.wav", "samples/4_02.wav", "samples/4_03.wav", "samples/4_04.wav", "samples/4_05.wav", "samples/4_06.wav", "samples/4_07.wav"], noteWithOctave: "G4", midi: 67, gain: 1.0 },
  { filenames: ["samples/5_01.wav", "samples/5_02.wav", "samples/5_03.wav", "samples/5_04.wav", "samples/5_05.wav", "samples/5_06.wav", "samples/5_07.wav"], noteWithOctave: "G#4", midi: 68, gain: 1.0 },
  { filenames: ["generated/Kalimba_A4_01.wav", "generated/Kalimba_A4_02.wav", "generated/Kalimba_A4_03.wav", "generated/Kalimba_A4_04.wav", "generated/Kalimba_A4_05.wav", "generated/Kalimba_A4_06.wav", "generated/Kalimba_A4_07.wav"], noteWithOctave: "A4", midi: 69, gain: 1.0 },
  { filenames: ["generated/Kalimba_A#4_01.wav", "generated/Kalimba_A#4_02.wav", "generated/Kalimba_A#4_03.wav", "generated/Kalimba_A#4_04.wav", "generated/Kalimba_A#4_05.wav", "generated/Kalimba_A#4_06.wav", "generated/Kalimba_A#4_07.wav"], noteWithOctave: "A#4", midi: 70, gain: 1.0 },
  { filenames: ["generated/Kalimba_B4_01.wav", "generated/Kalimba_B4_02.wav", "generated/Kalimba_B4_03.wav", "generated/Kalimba_B4_04.wav", "generated/Kalimba_B4_05.wav"], noteWithOctave: "B4", midi: 71, gain: 1.0 },
  { filenames: ["samples/6_01.wav", "samples/6_02.wav", "samples/6_03.wav", "samples/6_04.wav", "samples/6_05.wav"], noteWithOctave: "C5", midi: 72, gain: 1.0 },
  { filenames: ["samples/7_01.wav", "samples/7_02.wav", "samples/7_03.wav", "samples/7_04.wav", "samples/7_05.wav"], noteWithOctave: "C#5", midi: 73, gain: 1.0 },
  { filenames: ["generated/Kalimba_D5_01.wav", "generated/Kalimba_D5_02.wav", "generated/Kalimba_D5_03.wav", "generated/Kalimba_D5_04.wav", "generated/Kalimba_D5_05.wav"], noteWithOctave: "D5", midi: 74, gain: 1.0 },
  { filenames: ["generated/Kalimba_D#5_01.wav", "generated/Kalimba_D#5_02.wav", "generated/Kalimba_D#5_03.wav", "generated/Kalimba_D#5_04.wav", "generated/Kalimba_D#5_05.wav"], noteWithOctave: "D#5", midi: 75, gain: 1.0 },
  { filenames: ["generated/Kalimba_E5_01.wav", "generated/Kalimba_E5_02.wav", "generated/Kalimba_E5_03.wav", "generated/Kalimba_E5_04.wav", "generated/Kalimba_E5_05.wav"], noteWithOctave: "E5", midi: 76, gain: 1.0 },
  { filenames: ["generated/Kalimba_F5_01.wav", "generated/Kalimba_F5_02.wav", "generated/Kalimba_F5_03.wav", "generated/Kalimba_F5_04.wav", "generated/Kalimba_F5_05.wav"], noteWithOctave: "F5", midi: 77, gain: 1.0 },
  { filenames: ["generated/Kalimba_F#5_01.wav", "generated/Kalimba_F#5_02.wav", "generated/Kalimba_F#5_03.wav", "generated/Kalimba_F#5_04.wav", "generated/Kalimba_F#5_05.wav"], noteWithOctave: "F#5", midi: 78, gain: 1.0 },
  { filenames: ["generated/Kalimba_G5_01.wav", "generated/Kalimba_G5_02.wav", "generated/Kalimba_G5_03.wav", "generated/Kalimba_G5_04.wav", "generated/Kalimba_G5_05.wav"], noteWithOctave: "G5", midi: 79, gain: 1.0 },
  { filenames: ["generated/Kalimba_G#5_01.wav", "generated/Kalimba_G#5_02.wav", "generated/Kalimba_G#5_03.wav", "generated/Kalimba_G#5_04.wav", "generated/Kalimba_G#5_05.wav"], noteWithOctave: "G#5", midi: 80, gain: 1.0 },
  { filenames: ["generated/Kalimba_A5_01.wav", "generated/Kalimba_A5_02.wav", "generated/Kalimba_A5_03.wav", "generated/Kalimba_A5_04.wav", "generated/Kalimba_A5_05.wav"], noteWithOctave: "A5", midi: 81, gain: 1.0 },
  { filenames: ["generated/Kalimba_A#5_01.wav", "generated/Kalimba_A#5_02.wav", "generated/Kalimba_A#5_03.wav", "generated/Kalimba_A#5_04.wav", "generated/Kalimba_A#5_05.wav"], noteWithOctave: "A#5", midi: 82, gain: 1.0 }
];

export type ResolvedKalimbaSampleDef = {
  targetMidi: number;
  def: KalimbaSampleDef;
  semitoneShift: number;
  playbackRate: number;
};

export function getKalimbaPlaybackRate(semitoneShift: number) {
  return Math.pow(2, semitoneShift / 12);
}

// Nearest def by full MIDI distance (octave-aware, never by pitch class).
// Playable targets (60..82, i.e. every note any supported scale can
// produce) always hit an exact def: shift 0, rate 1.0. This fallback only
// engages for a target outside that range, which cannot happen given the
// scale engine's own root/interval bounds -- kept only as the same defensive
// fallback fluteSampleData.ts already has, for the same reason.
export function resolveKalimbaSampleDef(targetMidi: number): ResolvedKalimbaSampleDef {
  const def = KALIMBA_SAMPLE_DEFS.reduce((best, sample) => {
    const bestDistance = Math.abs(targetMidi - best.midi);
    const sampleDistance = Math.abs(targetMidi - sample.midi);
    return sampleDistance < bestDistance ? sample : best;
  });
  const semitoneShift = targetMidi - def.midi;

  return {
    targetMidi,
    def,
    semitoneShift,
    playbackRate: getKalimbaPlaybackRate(semitoneShift)
  };
}
