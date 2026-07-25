export const CHROMATIC_NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B"
] as const;

export type RootNote = (typeof CHROMATIC_NOTES)[number];
export type ScaleMode = "major" | "minor";

export type ScaleDegree = {
  degree: number;
  note: RootNote;
  semitone: number;
};

export const SCALE_INTERVALS: Record<ScaleMode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10]
};

export function isRootNote(value: string): value is RootNote {
  return CHROMATIC_NOTES.includes(value as RootNote);
}

export function generateScale(rootNote: RootNote, mode: ScaleMode): ScaleDegree[] {
  const rootIndex = CHROMATIC_NOTES.indexOf(rootNote);
  if (rootIndex < 0) {
    throw new Error(`Unsupported root note: ${rootNote}`);
  }

  return SCALE_INTERVALS[mode].map((interval, index) => {
    const noteIndex = (rootIndex + interval) % CHROMATIC_NOTES.length;
    return {
      degree: index + 1,
      note: CHROMATIC_NOTES[noteIndex],
      semitone: interval
    };
  });
}

export function getScaleName(rootNote: RootNote, mode: ScaleMode) {
  return `${rootNote} ${mode === "major" ? "Major" : "Minor"}`;
}
