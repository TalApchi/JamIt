import React from "react";
import { ScaleInstrument } from "../shared/ScaleInstrument";
import { resolveDistortionGuitarSample } from "../../audio/distortionGuitarSamples";
import { RootNote, ScaleMode } from "../../music/scaleEngine";
import { DISTORTION_GUITAR_IMAGE_SIZE, cloneDefaultDistortionGuitarHoles } from "./holeLayout";
import * as distortionGuitarCalibrationStore from "./calibrationStore";

type Props = {
  rootNote: RootNote;
  mode: ScaleMode;
  initialCalibrationMode?: boolean;
  onExitCalibration?: () => void;
};

const distortionGuitarImage = require("../../../assets/images/distortion-guitar.png");

// 14 pads, two octave rows -- reversed from the "natural" ascending order:
// the left 7 pads (degrees 1-7) play octave 5 (scale degree N, +1 octave
// above normal); the right 7 pads (degrees 8-14) play octave 4 (scale degree
// N-7, the normal, unshifted degree), per explicit design direction.
function resolveDegree(degree: number, scaleLength: number) {
  if (degree <= scaleLength) {
    return { scaleIndex: degree - 1, octaveOffset: 1 };
  }
  return { scaleIndex: degree - scaleLength - 1, octaveOffset: 0 };
}

export function DistortionGuitarInstrument(props: Props) {
  return (
    <ScaleInstrument
      {...props}
      instrumentLabel="Distortion Guitar"
      imageSource={distortionGuitarImage}
      imageSize={DISTORTION_GUITAR_IMAGE_SIZE}
      defaultPads={cloneDefaultDistortionGuitarHoles()}
      resolveSample={resolveDistortionGuitarSample}
      calibrationStore={distortionGuitarCalibrationStore}
      // Same instant-trigger, ring-past-release feel as the Kalimba/Piano,
      // not the Flute's hold/sustain-while-held breath-instrument feel.
      noteStartHoldMs={0}
      stopOnRelease={false}
      // Rectangular touch zones fit the vertical fret pads' real footprint,
      // same as Melodica/Piano and Synth Bass.
      padShape="rectangle"
      resolveDegree={resolveDegree}
    />
  );
}
