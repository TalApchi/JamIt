// Pure data + resolution logic for the Kalimba sample kit.
// Kept free of require()/expo imports so node test scripts can exercise it.
//
// The kit is a REAL 8-tine instrument recording (not a full chromatic kit
// like the Flute's): assets/audio/kalimba/Kalimba-SFZ-20190723. Its SFZ file
// maps each tine across a range of MIDI keys with the standard sampler
// technique (one recording covers several semitones via pitch-shifting),
// which is what makes "every note" playable at all from just 8 tines.
//
// Every tine has several round-robin takes (multiple recordings of the same
// pluck for natural variation); AudioEngine preloads and cycles through them.
//
// `midi` is each tine's nominal MIDI note (nearest semitone to its SFZ
// pitch_keycenter). The SFZ's `tune` cents offset (natural per-tine
// detuning, up to -40/+25 cents) is intentionally NOT applied here: samples
// play at their raw recorded pitch on an exact match, which is the
// instrument's authentic character, not a correction to make.
export type KalimbaTineDef = {
  filenames: string[];
  noteWithOctave: string;
  midi: number;
  gain: number;
};

export const KALIMBA_TINE_DEFS: KalimbaTineDef[] = [
  { filenames: ["F3_01.wav", "F3_03.wav", "F3_04.wav", "F3_05.wav"], noteWithOctave: "F3", midi: 53, gain: 1.0 },
  { filenames: ["1_01.wav", "1_02.wav", "1_03.wav", "1_04.wav", "1_05.wav"], noteWithOctave: "C4", midi: 60, gain: 1.0 },
  { filenames: ["2_01.wav", "2_02.wav", "2_03.wav", "2_04.wav", "2_05.wav"], noteWithOctave: "D#4", midi: 63, gain: 1.0 },
  { filenames: ["3_01.wav", "3_02.wav", "3_03.wav", "3_04.wav", "3_05.wav", "3_06.wav", "3_07.wav"], noteWithOctave: "E4", midi: 64, gain: 1.0 },
  { filenames: ["4_01.wav", "4_02.wav", "4_03.wav", "4_04.wav", "4_05.wav", "4_06.wav", "4_07.wav"], noteWithOctave: "G4", midi: 67, gain: 1.0 },
  { filenames: ["5_01.wav", "5_02.wav", "5_03.wav", "5_04.wav", "5_05.wav", "5_06.wav", "5_07.wav"], noteWithOctave: "G#4", midi: 68, gain: 1.0 },
  { filenames: ["6_01.wav", "6_02.wav", "6_03.wav", "6_04.wav", "6_05.wav"], noteWithOctave: "C5", midi: 72, gain: 1.0 },
  { filenames: ["7_01.wav", "7_02.wav", "7_03.wav", "7_04.wav", "7_05.wav"], noteWithOctave: "C#5", midi: 73, gain: 1.0 }
];

export type ResolvedKalimbaTineDef = {
  targetMidi: number;
  def: KalimbaTineDef;
  semitoneShift: number;
  playbackRate: number;
};

export function getKalimbaPlaybackRate(semitoneShift: number) {
  return Math.pow(2, semitoneShift / 12);
}

// Nearest tine by full MIDI distance (octave-aware, never by pitch class).
// Exact matches (semitoneShift === 0) play at rate 1.0; everything else
// falls back to the nearest tine, exactly like resolveFluteSampleDef.
export function resolveKalimbaTineDef(targetMidi: number): ResolvedKalimbaTineDef {
  const def = KALIMBA_TINE_DEFS.reduce((best, tine) => {
    const bestDistance = Math.abs(targetMidi - best.midi);
    const tineDistance = Math.abs(targetMidi - tine.midi);
    return tineDistance < bestDistance ? tine : best;
  });
  const semitoneShift = targetMidi - def.midi;

  return {
    targetMidi,
    def,
    semitoneShift,
    playbackRate: getKalimbaPlaybackRate(semitoneShift)
  };
}
