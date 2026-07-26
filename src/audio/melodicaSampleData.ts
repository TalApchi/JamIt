// Pure data + resolution logic for the Melodica sample kit.
// Kept free of require()/expo imports so node test scripts can exercise it.
//
// The kit is FreePats' "FM Piano 1" (public domain, DX7 "E. Piano 1"
// emulation) at assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/. It records
// exactly two pitch classes -- C and F# -- across octaves 1-7, at three
// velocity layers each (v60/v80/v100). This is NOT a full chromatic kit: it
// is the standard sparse-multisample SFZ technique (each recording's SFZ
// region spans +-3 semitones). Every note therefore always plays the v100
// (loudest) take of the nearest recorded C or F#, exactly like the Bamboo
// Flute's resolveFluteSampleDef -- neither the Flute nor the Kalimba are
// velocity-sensitive today, so there is no touch signal to pick a layer by.

export type MelodicaSampleDef = {
  filename: string;
  noteWithOctave: string;
  midi: number;
  gain: number;
};

export const MELODICA_SAMPLE_DEFS: MelodicaSampleDef[] = [
  { filename: "F#1v100.wav", noteWithOctave: "F#1", midi: 30, gain: 1.0 },
  { filename: "C2v100.wav", noteWithOctave: "C2", midi: 36, gain: 1.0 },
  { filename: "F#2v100.wav", noteWithOctave: "F#2", midi: 42, gain: 1.0 },
  { filename: "C3v100.wav", noteWithOctave: "C3", midi: 48, gain: 1.0 },
  { filename: "F#3v100.wav", noteWithOctave: "F#3", midi: 54, gain: 1.0 },
  { filename: "C4v100.wav", noteWithOctave: "C4", midi: 60, gain: 1.0 },
  { filename: "F#4v100.wav", noteWithOctave: "F#4", midi: 66, gain: 1.0 },
  { filename: "C5v100.wav", noteWithOctave: "C5", midi: 72, gain: 1.0 },
  { filename: "F#5v100.wav", noteWithOctave: "F#5", midi: 78, gain: 1.0 },
  { filename: "C6v100.wav", noteWithOctave: "C6", midi: 84, gain: 1.0 },
  { filename: "F#6v100.wav", noteWithOctave: "F#6", midi: 90, gain: 1.0 },
  { filename: "C7v100.wav", noteWithOctave: "C7", midi: 96, gain: 1.0 }
];

export type ResolvedMelodicaSampleDef = {
  targetMidi: number;
  def: MelodicaSampleDef;
  semitoneShift: number;
  playbackRate: number;
};

export function getMelodicaPlaybackRate(semitoneShift: number) {
  return Math.pow(2, semitoneShift / 12);
}

// Nearest sample by full MIDI distance (octave-aware, never by pitch class).
// Playable targets hit an exact sample (shift 0, rate 1.0) only when they
// happen to be a recorded C or F#; otherwise falls back to the nearest one,
// exactly like resolveFluteSampleDef.
export function resolveMelodicaSampleDef(targetMidi: number): ResolvedMelodicaSampleDef {
  const def = MELODICA_SAMPLE_DEFS.reduce((best, sample) => {
    const bestDistance = Math.abs(targetMidi - best.midi);
    const sampleDistance = Math.abs(targetMidi - sample.midi);
    return sampleDistance < bestDistance ? sample : best;
  });
  const semitoneShift = targetMidi - def.midi;

  return {
    targetMidi,
    def,
    semitoneShift,
    playbackRate: getMelodicaPlaybackRate(semitoneShift)
  };
}
