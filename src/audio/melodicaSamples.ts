import { MELODICA_SAMPLE_DEFS, resolveMelodicaSampleDef } from "./melodicaSampleData";
import { ResolvedSample } from "./sampleTypes";

export { getMelodicaPlaybackRate } from "./melodicaSampleData";

// Metro needs static require() calls (plain string literals, not template
// literals or variables), so the asset table is spelled out here in full and
// joined with the pure sample metadata (melodicaSampleData.ts) by filename --
// the exact same pattern fluteSamples.ts/kalimbaSamples.ts use. Every entry
// is either a real recorded v100 take (samples/) or an offline-pre-rendered
// WAV (generated/, produced by scripts/generate-melodica-shifted-samples.js).
const SAMPLE_SOURCES: Record<string, number> = {
  "samples/C4v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/C4v100.wav"),
  "samples/F#4v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/F#4v100.wav"),
  "samples/C5v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/C5v100.wav"),
  "samples/F#5v100.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/samples/F#5v100.wav"),
  "generated/Melodica_C#4.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_C#4.wav"),
  "generated/Melodica_D4.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_D4.wav"),
  "generated/Melodica_D#4.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_D#4.wav"),
  "generated/Melodica_E4.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_E4.wav"),
  "generated/Melodica_F4.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_F4.wav"),
  "generated/Melodica_G4.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_G4.wav"),
  "generated/Melodica_G#4.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_G#4.wav"),
  "generated/Melodica_A4.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_A4.wav"),
  "generated/Melodica_A#4.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_A#4.wav"),
  "generated/Melodica_B4.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_B4.wav"),
  "generated/Melodica_C#5.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_C#5.wav"),
  "generated/Melodica_D5.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_D5.wav"),
  "generated/Melodica_D#5.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_D#5.wav"),
  "generated/Melodica_E5.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_E5.wav"),
  "generated/Melodica_F5.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_F5.wav"),
  "generated/Melodica_G5.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_G5.wav"),
  "generated/Melodica_G#5.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_G#5.wav"),
  "generated/Melodica_A5.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_A5.wav"),
  "generated/Melodica_A#5.wav": require("../../assets/audio/piano/FM-Piano1 SFZ+WAV-20190916/generated/Melodica_A#5.wav")
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
