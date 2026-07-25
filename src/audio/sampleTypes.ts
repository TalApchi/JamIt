// Instrument-agnostic resolved-sample shape shared by AudioEngine and every
// instrument's sample-resolution module (fluteSamples.ts, kalimbaSamples.ts).
export type ResolvedSample = {
  targetMidi: number;
  // Round-robin take sources for the resolved note. Length 1 for the Flute
  // (single take per note); length >= 1 for the Kalimba (multiple takes per
  // tine). AudioEngine preloads one player per source and cycles through
  // them on each note-on.
  sources: number[];
  sourceFilenames: string[];
  // Convenience aliases for the first/primary take, used by debug logging
  // that previews the mapping before any note has actually sounded.
  source: number;
  sourceFilename: string;
  sourceNoteWithOctave: string;
  sourceMidi: number;
  semitoneShift: number;
  playbackRate: number;
  volume: number;
};

export type SampleResolver = (targetMidi: number) => ResolvedSample;
