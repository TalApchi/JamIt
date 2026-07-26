import { CalibratedPad, ImageSize } from "../shared/padLayout";

export type CalibratedMelodicaPad = CalibratedPad;

export const MELODICA_IMAGE_SIZE: ImageSize = {
  width: 1536,
  height: 1024
};

// Centers measured directly from the background image's pixels (scanned for
// white-key-face pixels, not eyeballed): 7 distinct white intervals at
// y=384-742 (key face vertical span). Pads 3 and 4 sit closer together than
// the rest (78px vs ~145px) -- a real piano layout pair of adjacent white
// keys with no black key between them (like E-F or B-C).
export const MELODICA_PADS: CalibratedMelodicaPad[] = [
  { degree: 1, sourceX: 351, sourceY: 563, visibleRadius: 50, hitRadius: 70, isRoot: true },
  { degree: 2, sourceX: 492, sourceY: 563, visibleRadius: 50, hitRadius: 70, isRoot: false },
  { degree: 3, sourceX: 639, sourceY: 563, visibleRadius: 50, hitRadius: 70, isRoot: false },
  { degree: 4, sourceX: 717, sourceY: 563, visibleRadius: 50, hitRadius: 70, isRoot: false },
  { degree: 5, sourceX: 867, sourceY: 563, visibleRadius: 50, hitRadius: 70, isRoot: false },
  { degree: 6, sourceX: 1015, sourceY: 563, visibleRadius: 50, hitRadius: 70, isRoot: false },
  { degree: 7, sourceX: 1170, sourceY: 563, visibleRadius: 50, hitRadius: 70, isRoot: false }
];

export function cloneDefaultMelodicaHoles(): CalibratedMelodicaPad[] {
  return MELODICA_PADS.map((pad) => ({ ...pad }));
}
