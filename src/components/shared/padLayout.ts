// src/components/shared/padLayout.ts
// Instrument-agnostic touch-pad geometry: cover-fit framing of a
// full-screen background image, and conversions between image-source pixel
// coordinates and on-screen container coordinates.

// hitRadius/visibleRadius double as the rectangle's half-width when
// hitHeight/visibleHeight are present -- see ScaleInstrumentProps.padShape.
// A pad with no height fields is a plain circle (hitRadius as its radius),
// which is every existing Flute/Kalimba pad; untouched, no migration needed.
export type CalibratedPad = {
  degree: number;
  sourceX: number;
  sourceY: number;
  visibleRadius: number;
  hitRadius: number;
  visibleHeight?: number;
  hitHeight?: number;
  isRoot: boolean;
};

export type PadShape = "circle" | "rectangle";

export type ImageSize = {
  width: number;
  height: number;
};

export type RenderedImageFrame = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  scale: number;
};

export function getCoverFrame(
  containerWidth: number,
  containerHeight: number,
  imageSize: ImageSize
): RenderedImageFrame {
  const scale = Math.max(containerWidth / imageSize.width, containerHeight / imageSize.height);
  const width = imageSize.width * scale;
  const height = imageSize.height * scale;

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
