import type { RgbaImage } from "@openrift/shared/scan/types";

import { zoomRegion } from "./scan-zoom";

export const WATCH_LONG_SIDE = 128;

function sizedContext(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return canvas.getContext("2d", { willReadFrequently: true });
}

export function grabRotatedFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  processingSize: number,
  turns: number,
  zoom = 1,
): RgbaImage | null {
  const { videoWidth, videoHeight } = video;
  if (videoWidth === 0 || videoHeight === 0) {
    return null;
  }
  const source = zoomRegion(videoWidth, videoHeight, zoom);
  const scale = Math.min(1, processingSize / Math.max(source.width, source.height));
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);

  const rotatedWidth = turns % 2 === 1 ? height : width;
  const rotatedHeight = turns % 2 === 1 ? width : height;
  const context = sizedContext(canvas, rotatedWidth, rotatedHeight);
  if (!context) {
    return null;
  }
  context.save();
  if (turns === 1) {
    context.translate(rotatedWidth, 0);
  } else if (turns === 2) {
    context.translate(rotatedWidth, rotatedHeight);
  } else if (turns === 3) {
    context.translate(0, rotatedHeight);
  }
  context.rotate((turns * Math.PI) / 2);
  context.drawImage(video, source.x, source.y, source.width, source.height, 0, 0, width, height);
  context.restore();
  const data = context.getImageData(0, 0, rotatedWidth, rotatedHeight);
  return { data: data.data, width: rotatedWidth, height: rotatedHeight };
}

/**
 * The placement watcher's frame: tiny, uncompensated, and only ever compared
 * against the frame before it.
 */
export function grabWatchFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  zoom = 1,
  longSide = WATCH_LONG_SIDE,
): RgbaImage | null {
  const { videoWidth, videoHeight } = video;
  if (videoWidth === 0 || videoHeight === 0) {
    return null;
  }
  const source = zoomRegion(videoWidth, videoHeight, zoom);
  const scale = Math.min(1, longSide / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const context = sizedContext(canvas, width, height);
  if (!context) {
    return null;
  }
  context.drawImage(video, source.x, source.y, source.width, source.height, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  return { data: pixels.data, width, height };
}
