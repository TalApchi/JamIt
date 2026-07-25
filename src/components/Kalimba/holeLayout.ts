import { CalibratedPad, ImageSize } from "../shared/padLayout";

export type CalibratedKalimbaPad = CalibratedPad;

export const KALIMBA_IMAGE_SIZE: ImageSize = {
  width: 1857,
  height: 847
};

export const KALIMBA_PADS: CalibratedKalimbaPad[] = [
  { degree: 1, sourceX: 475, sourceY: 402, visibleRadius: 50, hitRadius: 70, isRoot: true },
  { degree: 2, sourceX: 628, sourceY: 454, visibleRadius: 50, hitRadius: 70, isRoot: false },
  { degree: 3, sourceX: 781, sourceY: 503, visibleRadius: 50, hitRadius: 70, isRoot: false },
  { degree: 4, sourceX: 934, sourceY: 539, visibleRadius: 50, hitRadius: 70, isRoot: false },
  { degree: 5, sourceX: 1087, sourceY: 503, visibleRadius: 50, hitRadius: 70, isRoot: false },
  { degree: 6, sourceX: 1240, sourceY: 454, visibleRadius: 50, hitRadius: 70, isRoot: false },
  { degree: 7, sourceX: 1393, sourceY: 402, visibleRadius: 50, hitRadius: 70, isRoot: false }
];

export function cloneDefaultKalimbaHoles(): CalibratedKalimbaPad[] {
  return KALIMBA_PADS.map((pad) => ({ ...pad }));
}
