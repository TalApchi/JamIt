import React from "react";
import { ScaleInstrument } from "../shared/ScaleInstrument";
import { resolveFluteSample } from "../../audio/fluteSamples";
import { RootNote, ScaleMode } from "../../music/scaleEngine";
import { BAMBOO_FLUTE_IMAGE_SIZE, cloneDefaultFluteHoles } from "./holeLayout";
import * as fluteCalibrationStore from "./calibrationStore";

type Props = {
  rootNote: RootNote;
  mode: ScaleMode;
  initialCalibrationMode?: boolean;
  onExitCalibration?: () => void;
};

const fluteImage = require("../../../assets/images/bamboo-flute-final.png");

export function BambooFluteInstrument(props: Props) {
  return (
    <ScaleInstrument
      {...props}
      instrumentLabel="BambooFlute"
      imageSource={fluteImage}
      imageSize={BAMBOO_FLUTE_IMAGE_SIZE}
      defaultPads={cloneDefaultFluteHoles()}
      resolveSample={resolveFluteSample}
      calibrationStore={fluteCalibrationStore}
    />
  );
}
