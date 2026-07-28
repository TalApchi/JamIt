import React from "react";
import { ScaleInstrument } from "../shared/ScaleInstrument";
import { resolveSynthBassSample } from "../../audio/synthBassSamples";
import { RootNote, ScaleMode } from "../../music/scaleEngine";
import { SYNTH_BASS_IMAGE_SIZE, cloneDefaultSynthBassHoles } from "./holeLayout";
import * as synthBassCalibrationStore from "./calibrationStore";

type Props = {
  rootNote: RootNote;
  mode: ScaleMode;
  initialCalibrationMode?: boolean;
  onExitCalibration?: () => void;
};

const synthBassImage = require("../../../assets/images/synth-bass.png");

export function SynthBassInstrument(props: Props) {
  return (
    <ScaleInstrument
      {...props}
      instrumentLabel="Synth Bass"
      imageSource={synthBassImage}
      imageSize={SYNTH_BASS_IMAGE_SIZE}
      defaultPads={cloneDefaultSynthBassHoles()}
      resolveSample={resolveSynthBassSample}
      calibrationStore={synthBassCalibrationStore}
      // Same instant-trigger, ring-past-release feel as the Kalimba/Melodica,
      // not the Flute's hold/sustain-while-held breath-instrument feel.
      noteStartHoldMs={0}
      stopOnRelease={false}
      // Rectangular touch zones fit the vertical pads' real footprint far
      // better than the Flute/Kalimba's circular ones, same as Melodica/Piano.
      padShape="rectangle"
    />
  );
}
