import { CHROMATIC_NOTES, RootNote, ScaleDegree, ScaleMode, generateScale } from "./scaleEngine";

export type PitchedScaleDegree = ScaleDegree & {
  noteWithOctave: string;
  midi: number;
};

// The tonic (hole 1) always lives in octave 4: C major starts at C4 (60),
// B major starts at B4 (71). Higher degrees ascend from the tonic, crossing
// into octave 5 when needed (G major = G4 A4 B4 C5 D5 E5 F#5).
const ROOT_OCTAVE_C_MIDI = 60;

export function rootNoteToMidi(root: RootNote) {
  const noteIndex = CHROMATIC_NOTES.indexOf(root);
  if (noteIndex < 0) {
    throw new Error(`Unsupported root note: ${root}`);
  }

  return ROOT_OCTAVE_C_MIDI + noteIndex;
}

export function midiToNoteWithOctave(midi: number) {
  const note = CHROMATIC_NOTES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

export function generatePitchedScale(rootNote: RootNote, mode: ScaleMode): PitchedScaleDegree[] {
  const rootMidi = rootNoteToMidi(rootNote);

  return generateScale(rootNote, mode).map((degree) => {
    const midi = rootMidi + degree.semitone;
    return {
      ...degree,
      midi,
      noteWithOctave: midiToNoteWithOctave(midi)
    };
  });
}
