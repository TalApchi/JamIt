import { DISTORTION_GUITAR_SAMPLE_DEFS, resolveDistortionGuitarSampleDef } from "./distortionGuitarSampleData";
import { ResolvedSample } from "./sampleTypes";

export { getDistortionGuitarPlaybackRate } from "./distortionGuitarSampleData";

// Metro needs static require() calls (plain string literals, not template
// literals or variables), so the asset table is spelled out here in full and
// joined with the pure sample metadata (distortionGuitarSampleData.ts) by
// filename -- the exact same pattern every other instrument's samples module
// uses. Every entry is an offline-pre-rendered, trimmed WAV produced by
// scripts/generate-guitar-shifted-samples.js (see that file's own comment
// for why even the exact-match notes are pre-rendered here, unlike every
// other instrument).
const SAMPLE_SOURCES: Record<string, number> = {
  "generated/Guitar_A#4.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_A#4.wav"),
  "generated/Guitar_A#5.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_A#5.wav"),
  "generated/Guitar_A#6.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_A#6.wav"),
  "generated/Guitar_A4.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_A4.wav"),
  "generated/Guitar_A5.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_A5.wav"),
  "generated/Guitar_A6.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_A6.wav"),
  "generated/Guitar_B4.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_B4.wav"),
  "generated/Guitar_B5.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_B5.wav"),
  "generated/Guitar_C#4.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_C#4.wav"),
  "generated/Guitar_C#5.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_C#5.wav"),
  "generated/Guitar_C#6.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_C#6.wav"),
  "generated/Guitar_C4.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_C4.wav"),
  "generated/Guitar_C5.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_C5.wav"),
  "generated/Guitar_C6.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_C6.wav"),
  "generated/Guitar_D#4.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_D#4.wav"),
  "generated/Guitar_D#5.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_D#5.wav"),
  "generated/Guitar_D#6.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_D#6.wav"),
  "generated/Guitar_D4.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_D4.wav"),
  "generated/Guitar_D5.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_D5.wav"),
  "generated/Guitar_D6.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_D6.wav"),
  "generated/Guitar_E4.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_E4.wav"),
  "generated/Guitar_E5.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_E5.wav"),
  "generated/Guitar_E6.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_E6.wav"),
  "generated/Guitar_F#4.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_F#4.wav"),
  "generated/Guitar_F#5.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_F#5.wav"),
  "generated/Guitar_F#6.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_F#6.wav"),
  "generated/Guitar_F4.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_F4.wav"),
  "generated/Guitar_F5.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_F5.wav"),
  "generated/Guitar_F6.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_F6.wav"),
  "generated/Guitar_G#4.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_G#4.wav"),
  "generated/Guitar_G#5.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_G#5.wav"),
  "generated/Guitar_G#6.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_G#6.wav"),
  "generated/Guitar_G4.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_G4.wav"),
  "generated/Guitar_G5.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_G5.wav"),
  "generated/Guitar_G6.wav": require("../../assets/audio/DistortionGuitar/generated/Guitar_G6.wav")
};

DISTORTION_GUITAR_SAMPLE_DEFS.forEach((def) => {
  if (!(def.filename in SAMPLE_SOURCES)) {
    throw new Error(`Missing bundled audio asset for ${def.filename}`);
  }
});

export function resolveDistortionGuitarSample(targetMidi: number): ResolvedSample {
  const { def, semitoneShift, playbackRate } = resolveDistortionGuitarSampleDef(targetMidi);
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
