import React from "react";
import { ScaleInstrument } from "../shared/ScaleInstrument";
import { resolveKalimbaSample } from "../../audio/kalimbaSamples";
import { RootNote, ScaleMode } from "../../music/scaleEngine";
import { KALIMBA_IMAGE_SIZE, cloneDefaultKalimbaHoles } from "./holeLayout";
import * as kalimbaCalibrationStore from "./calibrationStore";

type Props = {
  rootNote: RootNote;
  mode: ScaleMode;
  initialCalibrationMode?: boolean;
  onExitCalibration?: () => void;
};

const kalimbaImage = require("../../../assets/images/kalimba.png");

export function KalimbaInstrument(props: Props) {
  return (
    <ScaleInstrument
      {...props}
      instrumentLabel="Kalimba"
      imageSource={kalimbaImage}
      imageSize={KALIMBA_IMAGE_SIZE}
      defaultPads={cloneDefaultKalimbaHoles()}
      resolveSample={resolveKalimbaSample}
      calibrationStore={kalimbaCalibrationStore}
      // A real kalimba tine sounds the instant it's plucked — no hold delay,
      // unlike the Flute's breath-instrument feel.
      noteStartHoldMs={0}
      // Lifting your finger doesn't silence a plucked tine -- it keeps
      // ringing and finishes on its own.
      stopOnRelease={false}
    />
  );
}
