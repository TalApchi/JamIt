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

// 14 pads, two octave rows, arranged so pitch rises continuously moving
// right to left across the WHOLE instrument with no reset at the row
// boundary: the left 7 pads (degrees 1-7) play octave 5, the right 7 pads
// (degrees 8-14) play octave 4, and WITHIN each half the scale degree
// descends left to right (degree 7 at the left edge of each half down to
// degree 1 -- the tonic -- at its right edge). E.g. C major: left = B5 A5
// G5 F5 E5 D5 C5, right = B4 A4 G4 F4 E4 D4 C4. The last pad of the left
// half (C5, the octave-5 tonic) is still higher than the first pad of the
// right half (B4, the octave-4 7th degree), so the ascent never resets.
function resolveDegree(degree: number, scaleLength: number) {
  if (degree <= scaleLength) {
    return { scaleIndex: scaleLength - degree, octaveOffset: 1 };
  }
  const rightPosition = degree - scaleLength;
  return { scaleIndex: scaleLength - rightPosition, octaveOffset: 0 };
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
