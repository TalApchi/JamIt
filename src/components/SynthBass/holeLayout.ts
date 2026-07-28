import { CalibratedPad, ImageSize } from "../shared/padLayout";

export type CalibratedSynthBassPad = CalibratedPad;

export const SYNTH_BASS_IMAGE_SIZE: ImageSize = {
  width: 1536,
  height: 1024
};

// Centers measured directly from the background image's pixels (scanned for
// bright-pad-vs-dark-background pixels, not eyeballed): 7 distinct vertical
// pads at y=244-838 (pad face vertical span), evenly spaced ~197px apart.
//
// Rectangular touch zones (hitRadius/visibleRadius double as half-width,
// hitHeight/visibleHeight as half-height -- see ScaleInstrumentProps.padShape)
// fit each vertical pad's real footprint. hitRadius=80 stays under half the
// ~197px center spacing (no overlap); hitHeight=280 covers most of the
// ~594px-tall pad face with margin top and bottom.
export const SYNTH_BASS_PADS: CalibratedSynthBassPad[] = [
  { degree: 1, sourceX: 179, sourceY: 541, visibleRadius: 66, hitRadius: 80, visibleHeight: 230, hitHeight: 280, isRoot: true },
  { degree: 2, sourceX: 377, sourceY: 541, visibleRadius: 66, hitRadius: 80, visibleHeight: 230, hitHeight: 280, isRoot: false },
  { degree: 3, sourceX: 574, sourceY: 541, visibleRadius: 66, hitRadius: 80, visibleHeight: 230, hitHeight: 280, isRoot: false },
  { degree: 4, sourceX: 770, sourceY: 541, visibleRadius: 66, hitRadius: 80, visibleHeight: 230, hitHeight: 280, isRoot: false },
  { degree: 5, sourceX: 967, sourceY: 541, visibleRadius: 66, hitRadius: 80, visibleHeight: 230, hitHeight: 280, isRoot: false },
  { degree: 6, sourceX: 1163, sourceY: 541, visibleRadius: 66, hitRadius: 80, visibleHeight: 230, hitHeight: 280, isRoot: false },
  { degree: 7, sourceX: 1359, sourceY: 541, visibleRadius: 66, hitRadius: 80, visibleHeight: 230, hitHeight: 280, isRoot: false }
];

export function cloneDefaultSynthBassHoles(): CalibratedSynthBassPad[] {
  return SYNTH_BASS_PADS.map((pad) => ({ ...pad }));
}
