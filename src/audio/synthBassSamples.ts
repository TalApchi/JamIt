import { SYNTH_BASS_SAMPLE_DEFS, resolveSynthBassSampleDef } from "./synthBassSampleData";
import { ResolvedSample } from "./sampleTypes";

export { getSynthBassPlaybackRate } from "./synthBassSampleData";

// Metro needs static require() calls (plain string literals, not template
// literals or variables), so the asset table is spelled out here in full and
// joined with the pure sample metadata (synthBassSampleData.ts) by filename
// -- the exact same pattern fluteSamples.ts/kalimbaSamples.ts/melodicaSamples.ts
// use. Every entry is either a real recorded take (assets/audio/SynthBass1/)
// or an offline-pre-rendered WAV (generated/, produced by
// scripts/generate-synthbass-shifted-samples.js).
const SAMPLE_SOURCES: Record<string, number> = {
  "C4.wav": require("../../assets/audio/SynthBass1/C4.wav"),
  "E4.wav": require("../../assets/audio/SynthBass1/E4.wav"),
  "G#4.wav": require("../../assets/audio/SynthBass1/G#4.wav"),
  "C5.wav": require("../../assets/audio/SynthBass1/C5.wav"),
  "E5.wav": require("../../assets/audio/SynthBass1/E5.wav"),
  "G#5.wav": require("../../assets/audio/SynthBass1/G#5.wav"),
  "generated/SynthBass_C#4.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_C#4.wav"),
  "generated/SynthBass_D4.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_D4.wav"),
  "generated/SynthBass_D#4.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_D#4.wav"),
  "generated/SynthBass_F4.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_F4.wav"),
  "generated/SynthBass_F#4.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_F#4.wav"),
  "generated/SynthBass_G4.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_G4.wav"),
  "generated/SynthBass_A4.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_A4.wav"),
  "generated/SynthBass_A#4.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_A#4.wav"),
  "generated/SynthBass_B4.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_B4.wav"),
  "generated/SynthBass_C#5.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_C#5.wav"),
  "generated/SynthBass_D5.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_D5.wav"),
  "generated/SynthBass_D#5.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_D#5.wav"),
  "generated/SynthBass_F5.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_F5.wav"),
  "generated/SynthBass_F#5.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_F#5.wav"),
  "generated/SynthBass_G5.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_G5.wav"),
  "generated/SynthBass_A5.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_A5.wav"),
  "generated/SynthBass_A#5.wav": require("../../assets/audio/SynthBass1/generated/SynthBass_A#5.wav")
};

SYNTH_BASS_SAMPLE_DEFS.forEach((def) => {
  if (!(def.filename in SAMPLE_SOURCES)) {
    throw new Error(`Missing bundled audio asset for ${def.filename}`);
  }
});

export function resolveSynthBassSample(targetMidi: number): ResolvedSample {
  const { def, semitoneShift, playbackRate } = resolveSynthBassSampleDef(targetMidi);
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
