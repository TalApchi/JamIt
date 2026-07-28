import { CalibratedPad, ImageSize } from "../shared/padLayout";

export type CalibratedDistortionGuitarPad = CalibratedPad;

export const DISTORTION_GUITAR_IMAGE_SIZE: ImageSize = {
  width: 1536,
  height: 1024
};

// Centers measured from the background image's pixels (a single horizontal
// strip of 14 fret-shaped pads, not two visual rows): 14 evenly spaced
// columns from x~170 to x~1520, ~96-97px apart, spanning the fret area
// y~430-980.
//
// Pad-to-note mapping (see DistortionGuitarInstrument.tsx's resolveDegree):
// pitch rises continuously moving right to left across the WHOLE
// instrument, no reset at the row boundary. Degrees 1-7 (left 7 pads) play
// octave 5, descending scale degree left to right (degree 7 at the left
// edge down to the tonic, degree 1, at the right edge of that half).
// Degrees 8-14 (right 7 pads) play octave 4 the same way. Degrees 7 and 14
// (the tonic pads of each half) are marked isRoot.
export const DISTORTION_GUITAR_PADS: CalibratedDistortionGuitarPad[] = [
  { degree: 1, sourceX: 218, sourceY: 700, visibleRadius: 33, hitRadius: 40, visibleHeight: 213, hitHeight: 260, isRoot: false },
  { degree: 2, sourceX: 314, sourceY: 700, visibleRadius: 33, hitRadius: 40, visibleHeight: 213, hitHeight: 260, isRoot: false },
  { degree: 3, sourceX: 411, sourceY: 700, visibleRadius: 33, hitRadius: 40, visibleHeight: 213, hitHeight: 260, isRoot: false },
  { degree: 4, sourceX: 507, sourceY: 700, visibleRadius: 33, hitRadius: 40, visibleHeight: 213, hitHeight: 260, isRoot: false },
  { degree: 5, sourceX: 604, sourceY: 700, visibleRadius: 33, hitRadius: 40, visibleHeight: 213, hitHeight: 260, isRoot: false },
  { degree: 6, sourceX: 700, sourceY: 700, visibleRadius: 33, hitRadius: 40, visibleHeight: 213, hitHeight: 260, isRoot: false },
  { degree: 7, sourceX: 796, sourceY: 700, visibleRadius: 33, hitRadius: 40, visibleHeight: 213, hitHeight: 260, isRoot: true },
  { degree: 8, sourceX: 893, sourceY: 700, visibleRadius: 33, hitRadius: 40, visibleHeight: 213, hitHeight: 260, isRoot: false },
  { degree: 9, sourceX: 989, sourceY: 700, visibleRadius: 33, hitRadius: 40, visibleHeight: 213, hitHeight: 260, isRoot: false },
  { degree: 10, sourceX: 1086, sourceY: 700, visibleRadius: 33, hitRadius: 40, visibleHeight: 213, hitHeight: 260, isRoot: false },
  { degree: 11, sourceX: 1182, sourceY: 700, visibleRadius: 33, hitRadius: 40, visibleHeight: 213, hitHeight: 260, isRoot: false },
  { degree: 12, sourceX: 1279, sourceY: 700, visibleRadius: 33, hitRadius: 40, visibleHeight: 213, hitHeight: 260, isRoot: false },
  { degree: 13, sourceX: 1375, sourceY: 700, visibleRadius: 33, hitRadius: 40, visibleHeight: 213, hitHeight: 260, isRoot: false },
  { degree: 14, sourceX: 1471, sourceY: 700, visibleRadius: 33, hitRadius: 40, visibleHeight: 213, hitHeight: 260, isRoot: true }
];

export function cloneDefaultDistortionGuitarHoles(): CalibratedDistortionGuitarPad[] {
  return DISTORTION_GUITAR_PADS.map((pad) => ({ ...pad }));
}
