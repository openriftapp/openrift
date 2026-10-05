/**
 * Camera shift between consecutive camera frames by coarse-to-fine block
 * matching on small grayscale copies of the whole frame.
 */
import { subPixelMinimum } from "./geometry";
import { luma } from "./image";
import type { GrayImage, RgbaImage } from "./types";

const FINE_WIDTH = 96;
const COARSE_RADIUS = 8;
const FINE_RADIUS = 2;
const COARSE_STEP = 2;
const DISTINCT_MATCH = 0.25;

export interface FramePyramid {
  coarse: GrayImage;
  fine: GrayImage;
  /** Frame pixels per fine pixel. */
  scale: number;
}

function shrink(frame: RgbaImage, width: number): GrayImage {
  const height = Math.max(1, Math.round((frame.height * width) / frame.width));
  const data = new Uint8Array(width * height);
  const stepX = frame.width / width;
  const stepY = frame.height / height;
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * stepY);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * stepY));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * stepX);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * stepX));
      let sum = 0;
      let count = 0;
      for (let sy = y0; sy < y1; sy += 2) {
        for (let sx = x0; sx < x1; sx += 2) {
          const index = (sy * frame.width + sx) * 4;
          sum += luma(
            frame.data[index] ?? 0,
            frame.data[index + 1] ?? 0,
            frame.data[index + 2] ?? 0,
          );
          count++;
        }
      }
      data[y * width + x] = count > 0 ? sum / count : 0;
    }
  }
  return { data, width, height };
}

function halve(image: GrayImage): GrayImage {
  const width = Math.max(1, Math.floor(image.width / 2));
  const height = Math.max(1, Math.floor(image.height / 2));
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = 2 * y * image.width + 2 * x;
      data[y * width + x] =
        ((image.data[index] ?? 0) +
          (image.data[index + 1] ?? 0) +
          (image.data[index + image.width] ?? 0) +
          (image.data[index + image.width + 1] ?? 0)) /
        4;
    }
  }
  return { data, width, height };
}

export function framePyramid(frame: RgbaImage): FramePyramid {
  const fine = shrink(frame, FINE_WIDTH);
  return { coarse: halve(fine), fine, scale: frame.width / FINE_WIDTH };
}

function meanAbsDifference(
  previous: GrayImage,
  current: GrayImage,
  dx: number,
  dy: number,
  step = 1,
): number {
  const x0 = Math.max(0, dx);
  const y0 = Math.max(0, dy);
  const x1 = Math.min(current.width, previous.width + dx);
  const y1 = Math.min(current.height, previous.height + dy);
  if (x1 - x0 < current.width / 2 || y1 - y0 < current.height / 2) {
    return Number.POSITIVE_INFINITY;
  }
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y += step) {
    const currentRow = y * current.width;
    const previousRow = (y - dy) * previous.width - dx;
    for (let x = x0; x < x1; x += step) {
      sum += Math.abs((current.data[currentRow + x] ?? 0) - (previous.data[previousRow + x] ?? 0));
      count++;
    }
  }
  return sum / count;
}

interface Match {
  x: number;
  y: number;
  cost: number;
  reliable: boolean;
}

function search(
  previous: GrayImage,
  current: GrayImage,
  centerX: number,
  centerY: number,
  radius: number,
  step = 1,
): Match {
  let best = {
    x: centerX,
    y: centerY,
    cost: meanAbsDifference(previous, current, centerX, centerY, step),
  };
  const costs: number[] = [];
  for (let dy = centerY - radius; dy <= centerY + radius; dy++) {
    for (let dx = centerX - radius; dx <= centerX + radius; dx++) {
      const cost = meanAbsDifference(previous, current, dx, dy, step);
      costs.push(cost);
      if (cost < best.cost) {
        best = { x: dx, y: dy, cost };
      }
    }
  }
  const finite = costs.filter((cost) => Number.isFinite(cost)).toSorted((a, b) => a - b);
  const median = finite[Math.floor(finite.length / 2)] ?? 0;
  const onEdge = Math.abs(best.x - centerX) === radius || Math.abs(best.y - centerY) === radius;
  const reliable = !onEdge && (median === 0 || best.cost <= median * DISTINCT_MATCH);
  return { ...best, reliable };
}

/** In frame pixels. */
export function frameShift(
  previous: FramePyramid,
  current: FramePyramid,
): { x: number; y: number } | null {
  const coarse = search(previous.coarse, current.coarse, 0, 0, COARSE_RADIUS, COARSE_STEP);
  if (!coarse.reliable) {
    return null;
  }
  const fine = search(previous.fine, current.fine, coarse.x * 2, coarse.y * 2, FINE_RADIUS);
  const cost = (dx: number, dy: number) => meanAbsDifference(previous.fine, current.fine, dx, dy);
  const x = fine.x + subPixelMinimum(cost(fine.x - 1, fine.y), fine.cost, cost(fine.x + 1, fine.y));
  const y = fine.y + subPixelMinimum(cost(fine.x, fine.y - 1), fine.cost, cost(fine.x, fine.y + 1));
  return { x: x * current.scale, y: y * current.scale };
}

export interface ShiftTracker {
  key: FramePyramid | null;
  applied: { x: number; y: number };
  lost: boolean;
}

export function createShiftTracker(): ShiftTracker {
  return { key: null, applied: { x: 0, y: 0 }, lost: false };
}

/** In frame pixels. */
export function trackShift(tracker: ShiftTracker, current: FramePyramid): { x: number; y: number } {
  if (!tracker.key) {
    tracker.key = current;
    tracker.applied = { x: 0, y: 0 };
    tracker.lost = false;
    return { x: 0, y: 0 };
  }
  const total = frameShift(tracker.key, current);
  tracker.lost = total === null;
  if (!total) {
    tracker.key = current;
    tracker.applied = { x: 0, y: 0 };
    return { x: 0, y: 0 };
  }
  const step = { x: total.x - tracker.applied.x, y: total.y - tracker.applied.y };
  const limit = COARSE_RADIUS * current.scale;
  if (Math.hypot(total.x, total.y) > limit) {
    tracker.key = current;
    tracker.applied = { x: 0, y: 0 };
  } else {
    tracker.applied = total;
  }
  return step;
}
