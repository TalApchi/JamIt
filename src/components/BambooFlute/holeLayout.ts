import {
  CalibratedPad,
  RenderedImageFrame,
  containerPointToSource,
  getCoverFrame as getSharedCoverFrame,
  sourcePointToContainer
} from "../shared/padLayout";

export type FluteHoleLayout = CalibratedPad;
export type CalibratedFluteHole = CalibratedPad;
export type { RenderedImageFrame };
export { containerPointToSource, sourcePointToContainer };

export const BAMBOO_FLUTE_IMAGE_SIZE = {
  width: 853,
  height: 1844
};

export const BAMBOO_FLUTE_HOLES: FluteHoleLayout[] = [
  { degree: 1, sourceX: 426, sourceY: 553, visibleRadius: 73, hitRadius: 96, isRoot: true },
  { degree: 2, sourceX: 426, sourceY: 720, visibleRadius: 51, hitRadius: 76, isRoot: false },
  { degree: 3, sourceX: 426, sourceY: 870, visibleRadius: 51, hitRadius: 76, isRoot: false },
  { degree: 4, sourceX: 426, sourceY: 1022, visibleRadius: 51, hitRadius: 76, isRoot: false },
  { degree: 5, sourceX: 426, sourceY: 1176, visibleRadius: 51, hitRadius: 76, isRoot: false },
  { degree: 6, sourceX: 426, sourceY: 1331, visibleRadius: 51, hitRadius: 76, isRoot: false },
  { degree: 7, sourceX: 426, sourceY: 1492, visibleRadius: 51, hitRadius: 76, isRoot: false }
];

// Preserves the Flute's original 2-argument call signature for its existing
// caller (BambooFluteInstrument.tsx, until a later task replaces it).
export function getCoverFrame(containerWidth: number, containerHeight: number): RenderedImageFrame {
  return getSharedCoverFrame(containerWidth, containerHeight, BAMBOO_FLUTE_IMAGE_SIZE);
}

export function cloneDefaultFluteHoles(): CalibratedFluteHole[] {
  return BAMBOO_FLUTE_HOLES.map((hole) => ({ ...hole }));
}
