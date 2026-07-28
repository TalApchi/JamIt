// Pure data + resolution logic for the Distortion Guitar sample kit.
// Kept free of require()/expo imports so node test scripts can exercise it.
//
// The kit has an EXACT, dedicated, pre-rendered sample for every playable
// note (MIDI 60..94 = C4..A#6). This range is wider than every other
// instrument's 60..82: the Distortion Guitar has 14 pads across two octave
// rows (the normal scale degrees, MIDI 60..82, PLUS the same degrees one
// octave higher, MIDI 72..94), so the union is 60..94.
//
// ALL 35 notes come from `generated/`, produced by
// scripts/generate-guitar-shifted-samples.js -- including the 7 that land
// exactly on a recorded anchor (C#4, F4, A4, C#5, F5, A5, C6; shift 0, no
// resampling needed for those). This differs from every other instrument
// (which reference their exact-match recordings directly): the raw pack is
// a looping-sustain guitar patch (several seconds long per recording, per
// the SFZ's loop points), and undecorated it rang out far longer than felt
// right for a tap-to-play pad. Every note -- exact or resampled -- is
// therefore also trimmed to ~1 second with a short fade-out by that same
// script, so duration is consistent across the whole instrument regardless
// of which anchor it came from.
//
// The other 28 notes have no matching recording and are resampled from the
// nearest recorded anchor (Lanczos kernel, same technique as every other
// instrument's own generated/ files) before trimming. The highest anchor
// (C6, midi 84) is 10 semitones below the top of the range (94) -- the top
// 11 notes (84..94) all shift up from C6, the largest shift any instrument
// in this app has needed; verified within +-5.4 cents (see
// scripts/test-guitar-mapping.js), the largest shift tolerated so far.
// Pre-rendering was used from the start (not attempted at runtime first)
// because runtime playbackRate-based pitch shifting was already confirmed
// UNRELIABLE on-device for the Melodica/Piano -- the same underlying
// expo-audio/OS behavior applies to every instrument in this app. Every
// note therefore plays at playbackRate 1.0; the nearest-sample + rate =
// 2^(shift/12) resolver only ever engages for targets outside 60..94, which
// the scale engine (at either octave row) can never produce.
// `gain` normalizes each file's sustained RMS; left at 1.0 for now (no RMS
// analysis pass yet), same starting point as the Kalimba/Melodica/Synth Bass.
export type DistortionGuitarSampleDef = {
  filename: string;
  noteWithOctave: string;
  midi: number;
  gain: number;
};

export const DISTORTION_GUITAR_SAMPLE_DEFS: DistortionGuitarSampleDef[] = [
  { filename: "generated/Guitar_C4.wav", noteWithOctave: "C4", midi: 60, gain: 1.0 },
  { filename: "generated/Guitar_C#4.wav", noteWithOctave: "C#4", midi: 61, gain: 1.0 },
  { filename: "generated/Guitar_D4.wav", noteWithOctave: "D4", midi: 62, gain: 1.0 },
  { filename: "generated/Guitar_D#4.wav", noteWithOctave: "D#4", midi: 63, gain: 1.0 },
  { filename: "generated/Guitar_E4.wav", noteWithOctave: "E4", midi: 64, gain: 1.0 },
  { filename: "generated/Guitar_F4.wav", noteWithOctave: "F4", midi: 65, gain: 1.0 },
  { filename: "generated/Guitar_F#4.wav", noteWithOctave: "F#4", midi: 66, gain: 1.0 },
  { filename: "generated/Guitar_G4.wav", noteWithOctave: "G4", midi: 67, gain: 1.0 },
  { filename: "generated/Guitar_G#4.wav", noteWithOctave: "G#4", midi: 68, gain: 1.0 },
  { filename: "generated/Guitar_A4.wav", noteWithOctave: "A4", midi: 69, gain: 1.0 },
  { filename: "generated/Guitar_A#4.wav", noteWithOctave: "A#4", midi: 70, gain: 1.0 },
  { filename: "generated/Guitar_B4.wav", noteWithOctave: "B4", midi: 71, gain: 1.0 },
  { filename: "generated/Guitar_C5.wav", noteWithOctave: "C5", midi: 72, gain: 1.0 },
  { filename: "generated/Guitar_C#5.wav", noteWithOctave: "C#5", midi: 73, gain: 1.0 },
  { filename: "generated/Guitar_D5.wav", noteWithOctave: "D5", midi: 74, gain: 1.0 },
  { filename: "generated/Guitar_D#5.wav", noteWithOctave: "D#5", midi: 75, gain: 1.0 },
  { filename: "generated/Guitar_E5.wav", noteWithOctave: "E5", midi: 76, gain: 1.0 },
  { filename: "generated/Guitar_F5.wav", noteWithOctave: "F5", midi: 77, gain: 1.0 },
  { filename: "generated/Guitar_F#5.wav", noteWithOctave: "F#5", midi: 78, gain: 1.0 },
  { filename: "generated/Guitar_G5.wav", noteWithOctave: "G5", midi: 79, gain: 1.0 },
  { filename: "generated/Guitar_G#5.wav", noteWithOctave: "G#5", midi: 80, gain: 1.0 },
  { filename: "generated/Guitar_A5.wav", noteWithOctave: "A5", midi: 81, gain: 1.0 },
  { filename: "generated/Guitar_A#5.wav", noteWithOctave: "A#5", midi: 82, gain: 1.0 },
  { filename: "generated/Guitar_B5.wav", noteWithOctave: "B5", midi: 83, gain: 1.0 },
  { filename: "generated/Guitar_C6.wav", noteWithOctave: "C6", midi: 84, gain: 1.0 },
  { filename: "generated/Guitar_C#6.wav", noteWithOctave: "C#6", midi: 85, gain: 1.0 },
  { filename: "generated/Guitar_D6.wav", noteWithOctave: "D6", midi: 86, gain: 1.0 },
  { filename: "generated/Guitar_D#6.wav", noteWithOctave: "D#6", midi: 87, gain: 1.0 },
  { filename: "generated/Guitar_E6.wav", noteWithOctave: "E6", midi: 88, gain: 1.0 },
  { filename: "generated/Guitar_F6.wav", noteWithOctave: "F6", midi: 89, gain: 1.0 },
  { filename: "generated/Guitar_F#6.wav", noteWithOctave: "F#6", midi: 90, gain: 1.0 },
  { filename: "generated/Guitar_G6.wav", noteWithOctave: "G6", midi: 91, gain: 1.0 },
  { filename: "generated/Guitar_G#6.wav", noteWithOctave: "G#6", midi: 92, gain: 1.0 },
  { filename: "generated/Guitar_A6.wav", noteWithOctave: "A6", midi: 93, gain: 1.0 },
  { filename: "generated/Guitar_A#6.wav", noteWithOctave: "A#6", midi: 94, gain: 1.0 }
];

export type ResolvedDistortionGuitarSampleDef = {
  targetMidi: number;
  def: DistortionGuitarSampleDef;
  semitoneShift: number;
  playbackRate: number;
};

export function getDistortionGuitarPlaybackRate(semitoneShift: number) {
  return Math.pow(2, semitoneShift / 12);
}

// Nearest def by full MIDI distance (octave-aware, never by pitch class).
// Playable targets (60..94, i.e. every note either octave row of any
// supported scale can produce) always hit an exact def: shift 0, rate 1.0.
// This fallback only engages for a target outside that range, which cannot
// happen given the scale engine's own root/interval bounds plus the fixed
// +12 upper-row offset -- kept only as the same defensive fallback every
// other instrument's sample data module has.
export function resolveDistortionGuitarSampleDef(targetMidi: number): ResolvedDistortionGuitarSampleDef {
  const def = DISTORTION_GUITAR_SAMPLE_DEFS.reduce((best, sample) => {
    const bestDistance = Math.abs(targetMidi - best.midi);
    const sampleDistance = Math.abs(targetMidi - sample.midi);
    return sampleDistance < bestDistance ? sample : best;
  });
  const semitoneShift = targetMidi - def.midi;

  return {
    targetMidi,
    def,
    semitoneShift,
    playbackRate: getDistortionGuitarPlaybackRate(semitoneShift)
  };
}
