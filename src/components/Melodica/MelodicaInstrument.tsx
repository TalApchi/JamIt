import React from "react";
import { ScaleInstrument } from "../shared/ScaleInstrument";
import { resolveMelodicaSample } from "../../audio/melodicaSamples";
import { RootNote, ScaleMode } from "../../music/scaleEngine";
import { MELODICA_IMAGE_SIZE, cloneDefaultMelodicaHoles } from "./holeLayout";
import * as melodicaCalibrationStore from "./calibrationStore";

type Props = {
  rootNote: RootNote;
  mode: ScaleMode;
  initialCalibrationMode?: boolean;
  onExitCalibration?: () => void;
};

const melodicaImage = require("../../../assets/images/melodica.png");

export function MelodicaInstrument(props: Props) {
  return (
    <ScaleInstrument
      {...props}
      instrumentLabel="Melodica"
      imageSource={melodicaImage}
      imageSize={MELODICA_IMAGE_SIZE}
      defaultPads={cloneDefaultMelodicaHoles()}
      resolveSample={resolveMelodicaSample}
      calibrationStore={melodicaCalibrationStore}
      // Same instant-trigger, ring-past-release feel as the Kalimba, not the
      // Flute's hold/sustain-while-held breath-instrument feel.
      noteStartHoldMs={0}
      stopOnRelease={false}
      // Rectangular touch zones fit the white keys' real footprint far
      // better than the Flute/Kalimba's circular ones.
      padShape="rectangle"
    />
  );
}
