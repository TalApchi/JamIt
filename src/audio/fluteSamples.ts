import { FLUTE_SAMPLE_DEFS, resolveFluteSampleDef } from "./fluteSampleData";

export { getPlaybackRate } from "./fluteSampleData";

export type ResolvedFluteSample = {
  targetMidi: number;
  source: number;
  sourceFilename: string;
  sourceNoteWithOctave: string;
  sourceMidi: number;
  semitoneShift: number;
  playbackRate: number;
  volume: number;
};

// Metro needs static require() calls, so the asset table is spelled out here
// and joined with the pure sample metadata by filename.
const SAMPLE_SOURCES: Record<string, number> = {
  "FluteClean2_C2.wav": require("../../flute_sound_kit/FluteClean2_C2.wav"),
  "generated/Flute_C#4.wav": require("../../flute_sound_kit/generated/Flute_C#4.wav"),
  "generated/Flute_D4.wav": require("../../flute_sound_kit/generated/Flute_D4.wav"),
  "FluteClean2_D#2.wav": require("../../flute_sound_kit/FluteClean2_D#2.wav"),
  "generated/Flute_E4.wav": require("../../flute_sound_kit/generated/Flute_E4.wav"),
  "generated/Flute_F4.wav": require("../../flute_sound_kit/generated/Flute_F4.wav"),
  "FluteClean2_F#2.wav": require("../../flute_sound_kit/FluteClean2_F#2.wav"),
  "generated/Flute_G4.wav": require("../../flute_sound_kit/generated/Flute_G4.wav"),
  "generated/Flute_G#4.wav": require("../../flute_sound_kit/generated/Flute_G#4.wav"),
  "FluteClean2_A2.wav": require("../../flute_sound_kit/FluteClean2_A2.wav"),
  "generated/Flute_A#4.wav": require("../../flute_sound_kit/generated/Flute_A#4.wav"),
  "generated/Flute_B4.wav": require("../../flute_sound_kit/generated/Flute_B4.wav"),
  "FluteClean2_C3.wav": require("../../flute_sound_kit/FluteClean2_C3.wav"),
  "generated/Flute_C#5.wav": require("../../flute_sound_kit/generated/Flute_C#5.wav"),
  "generated/Flute_D5.wav": require("../../flute_sound_kit/generated/Flute_D5.wav"),
  "FluteClean2_D#3.wav": require("../../flute_sound_kit/FluteClean2_D#3.wav"),
  "generated/Flute_E5.wav": require("../../flute_sound_kit/generated/Flute_E5.wav"),
  "generated/Flute_F5.wav": require("../../flute_sound_kit/generated/Flute_F5.wav"),
  "FluteClean2_F#3.wav": require("../../flute_sound_kit/FluteClean2_F#3.wav"),
  "generated/Flute_G5.wav": require("../../flute_sound_kit/generated/Flute_G5.wav"),
  "generated/Flute_G#5.wav": require("../../flute_sound_kit/generated/Flute_G#5.wav"),
  "FluteClean2_A3.wav": require("../../flute_sound_kit/FluteClean2_A3.wav"),
  "generated/Flute_A#5.wav": require("../../flute_sound_kit/generated/Flute_A#5.wav"),
  "FluteClean2_C4.wav": require("../../flute_sound_kit/FluteClean2_C4.wav")
};

FLUTE_SAMPLE_DEFS.forEach((def) => {
  if (!(def.filename in SAMPLE_SOURCES)) {
    throw new Error(`Missing bundled audio asset for ${def.filename}`);
  }
});

export function resolveFluteSample(targetMidi: number): ResolvedFluteSample {
  const { def, semitoneShift, playbackRate } = resolveFluteSampleDef(targetMidi);

  return {
    targetMidi,
    source: SAMPLE_SOURCES[def.filename],
    sourceFilename: def.filename,
    sourceNoteWithOctave: def.noteWithOctave,
    sourceMidi: def.midi,
    semitoneShift,
    playbackRate,
    volume: def.gain
  };
}
