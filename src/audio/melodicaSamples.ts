import { MELODICA_SAMPLE_DEFS, resolveMelodicaSampleDef } from "./melodicaSampleData";
import { ResolvedSample } from "./sampleTypes";

export { getMelodicaPlaybackRate } from "./melodicaSampleData";

// Metro needs static require() calls (plain string literals, not template
// literals or variables), so the asset table is spelled out here in full and
// joined with the pure sample metadata (melodicaSampleData.ts) by filename --
// the exact same pattern fluteSamples.ts/kalimbaSamples.ts use.
const SAMPLE_SOURCES: Record<string, number> = {
  "F#1v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/F#1v100.wav"),
  "C2v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/C2v100.wav"),
  "F#2v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/F#2v100.wav"),
  "C3v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/C3v100.wav"),
  "F#3v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/F#3v100.wav"),
  "C4v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/C4v100.wav"),
  "F#4v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/F#4v100.wav"),
  "C5v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/C5v100.wav"),
  "F#5v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/F#5v100.wav"),
  "C6v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/C6v100.wav"),
  "F#6v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/F#6v100.wav"),
  "C7v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/C7v100.wav")
};

MELODICA_SAMPLE_DEFS.forEach((def) => {
  if (!(def.filename in SAMPLE_SOURCES)) {
    throw new Error(`Missing bundled audio asset for ${def.filename}`);
  }
});

export function resolveMelodicaSample(targetMidi: number): ResolvedSample {
  const { def, semitoneShift, playbackRate } = resolveMelodicaSampleDef(targetMidi);
  const source = SAMPLE_SOURCES[def.filename];

  return {
    targetMidi,
    sources: [source],
    sourceFilenames: [def.filename],
    source,
    sourceFilename: def.filename,
    sourceNoteWithOctave: def.noteWithOctave,
    sourceMidi: def.midi,
    semitoneShift,
    playbackRate,
    volume: def.gain
  };
}
