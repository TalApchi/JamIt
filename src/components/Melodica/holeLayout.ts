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
//
// Rectangular touch zones (hitRadius/visibleRadius double as half-width,
// hitHeight/visibleHeight as half-height -- see ScaleInstrumentProps.padShape)
// fit a white key's real footprint far better than a circle. hitRadius=32 is
// narrow enough that the two closely-spaced keys (3 and 4, 78px apart) don't
// overlap (64px combined width, ~14px gap); hitHeight=150 covers most of the
// visible key length (300px out of the 358px-tall key face) with margin top
// and bottom.
export const MELODICA_PADS: CalibratedMelodicaPad[] = [
  { degree: 1, sourceX: 351, sourceY: 563, visibleRadius: 26, hitRadius: 32, visibleHeight: 123, hitHeight: 150, isRoot: true },
  { degree: 2, sourceX: 492, sourceY: 563, visibleRadius: 26, hitRadius: 32, visibleHeight: 123, hitHeight: 150, isRoot: false },
  { degree: 3, sourceX: 639, sourceY: 563, visibleRadius: 26, hitRadius: 32, visibleHeight: 123, hitHeight: 150, isRoot: false },
  { degree: 4, sourceX: 717, sourceY: 563, visibleRadius: 26, hitRadius: 32, visibleHeight: 123, hitHeight: 150, isRoot: false },
  { degree: 5, sourceX: 867, sourceY: 563, visibleRadius: 26, hitRadius: 32, visibleHeight: 123, hitHeight: 150, isRoot: false },
  { degree: 6, sourceX: 1015, sourceY: 563, visibleRadius: 26, hitRadius: 32, visibleHeight: 123, hitHeight: 150, isRoot: false },
  { degree: 7, sourceX: 1170, sourceY: 563, visibleRadius: 26, hitRadius: 32, visibleHeight: 123, hitHeight: 150, isRoot: false }
];

export function cloneDefaultMelodicaHoles(): CalibratedMelodicaPad[] {
  return MELODICA_PADS.map((pad) => ({ ...pad }));
}
