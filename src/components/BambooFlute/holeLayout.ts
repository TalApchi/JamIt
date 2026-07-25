export type FluteHoleLayout = {
  degree: number;
  sourceX: number;
  sourceY: number;
  visibleRadius: number;
  hitRadius: number;
  isRoot: boolean;
};

export type CalibratedFluteHole = FluteHoleLayout;

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

export type RenderedImageFrame = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  scale: number;
};

export function getCoverFrame(containerWidth: number, containerHeight: number): RenderedImageFrame {
  const scale = Math.max(
    containerWidth / BAMBOO_FLUTE_IMAGE_SIZE.width,
    containerHeight / BAMBOO_FLUTE_IMAGE_SIZE.height
  );
  const width = BAMBOO_FLUTE_IMAGE_SIZE.width * scale;
  const height = BAMBOO_FLUTE_IMAGE_SIZE.height * scale;

  return {
    width,
    height,
    offsetX: (containerWidth - width) / 2,
    offsetY: (containerHeight - height) / 2,
    scale
  };
}

export function sourcePointToContainer(sourceX: number, sourceY: number, frame: RenderedImageFrame) {
  return {
    x: frame.offsetX + sourceX * frame.scale,
    y: frame.offsetY + sourceY * frame.scale
  };
}

export function containerPointToSource(containerX: number, containerY: number, frame: RenderedImageFrame) {
  return {
    sourceX: (containerX - frame.offsetX) / frame.scale,
    sourceY: (containerY - frame.offsetY) / frame.scale
  };
}

export function cloneDefaultFluteHoles(): CalibratedFluteHole[] {
  return BAMBOO_FLUTE_HOLES.map((hole) => ({ ...hole }));
}
