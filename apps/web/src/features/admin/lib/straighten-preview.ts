import type { ImageQuad } from "@openrift/shared/contracts/admin/card-images";
import type { RgbaImage } from "@openrift/shared/scan/types";
import { straightenedSize, unwarpQuad } from "@openrift/shared/scan/unwarp";

import { scaleQuad } from "@/features/admin/lib/straighten-quad";

const SOURCE_MAX_EDGE = 1400;
const PREVIEW_MAX_EDGE = 360;

export interface PreviewSource {
  frame: RgbaImage;
  scale: number;
}

export function previewSize(quad: ImageQuad): { width: number; height: number } {
  const { width, height } = straightenedSize(quad);
  const longest = Math.max(width, height);
  if (longest <= PREVIEW_MAX_EDGE || longest === 0) {
    return { width: Math.max(1, width), height: Math.max(1, height) };
  }
  const factor = PREVIEW_MAX_EDGE / longest;
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
  };
}

export function readPreviewSource(image: HTMLImageElement): PreviewSource | null {
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  if (longest === 0) {
    return null;
  }
  const scale = Math.min(1, SOURCE_MAX_EDGE / longest);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) {
    return null;
  }
  context.drawImage(image, 0, 0, width, height);
  try {
    const pixels = context.getImageData(0, 0, width, height);
    return { frame: { data: pixels.data, width, height }, scale };
  } catch {
    return null;
  }
}

export function drawStraightenedPreview(
  canvas: HTMLCanvasElement,
  source: PreviewSource,
  quad: ImageQuad,
): boolean {
  const { width, height } = previewSize(quad);
  const rectified = unwarpQuad(source.frame, scaleQuad(quad, source.scale), width, height);
  if (rectified === null) {
    return false;
  }
  const context = canvas.getContext("2d");
  if (context === null) {
    return false;
  }
  canvas.width = width;
  canvas.height = height;
  const pixels = context.createImageData(width, height);
  pixels.data.set(rectified.data);
  context.putImageData(pixels, 0, 0);
  return true;
}
