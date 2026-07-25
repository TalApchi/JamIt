import { KALIMBA_TINE_DEFS, resolveKalimbaTineDef } from "./kalimbaSampleData";
import { ResolvedSample } from "./sampleTypes";

export { getKalimbaPlaybackRate } from "./kalimbaSampleData";

// Metro needs static require() calls (plain string literals, not template
// literals or variables), so the asset table is spelled out here in full and
// joined with the pure sample metadata (kalimbaSampleData.ts) by filename —
// the exact same pattern fluteSamples.ts uses.
const SAMPLE_SOURCES: Record<string, number> = {
  "F3_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/F3_01.wav"),
  "F3_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/F3_03.wav"),
  "F3_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/F3_04.wav"),
  "F3_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/F3_05.wav"),
  "1_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/1_01.wav"),
  "1_02.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/1_02.wav"),
  "1_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/1_03.wav"),
  "1_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/1_04.wav"),
  "1_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/1_05.wav"),
  "2_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/2_01.wav"),
  "2_02.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/2_02.wav"),
  "2_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/2_03.wav"),
  "2_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/2_04.wav"),
  "2_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/2_05.wav"),
  "3_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/3_01.wav"),
  "3_02.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/3_02.wav"),
  "3_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/3_03.wav"),
  "3_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/3_04.wav"),
  "3_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/3_05.wav"),
  "3_06.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/3_06.wav"),
  "3_07.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/3_07.wav"),
  "4_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/4_01.wav"),
  "4_02.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/4_02.wav"),
  "4_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/4_03.wav"),
  "4_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/4_04.wav"),
  "4_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/4_05.wav"),
  "4_06.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/4_06.wav"),
  "4_07.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/4_07.wav"),
  "5_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/5_01.wav"),
  "5_02.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/5_02.wav"),
  "5_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/5_03.wav"),
  "5_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/5_04.wav"),
  "5_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/5_05.wav"),
  "5_06.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/5_06.wav"),
  "5_07.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/5_07.wav"),
  "6_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/6_01.wav"),
  "6_02.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/6_02.wav"),
  "6_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/6_03.wav"),
  "6_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/6_04.wav"),
  "6_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/6_05.wav"),
  "7_01.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/7_01.wav"),
  "7_02.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/7_02.wav"),
  "7_03.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/7_03.wav"),
  "7_04.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/7_04.wav"),
  "7_05.wav": require("../../assets/audio/kalimba/Kalimba-SFZ-20190723/samples/7_05.wav")
};

KALIMBA_TINE_DEFS.forEach((def) => {
  def.filenames.forEach((filename) => {
    if (!(filename in SAMPLE_SOURCES)) {
      throw new Error(`Missing bundled audio asset for ${filename}`);
    }
  });
});

export function resolveKalimbaSample(targetMidi: number): ResolvedSample {
  const { def, semitoneShift, playbackRate } = resolveKalimbaTineDef(targetMidi);
  const sources = def.filenames.map((filename) => SAMPLE_SOURCES[filename]);

  return {
    targetMidi,
    sources,
    sourceFilenames: def.filenames,
    source: sources[0],
    sourceFilename: def.filenames[0],
    sourceNoteWithOctave: def.noteWithOctave,
    sourceMidi: def.midi,
    semitoneShift,
    playbackRate,
    volume: def.gain
  };
}
