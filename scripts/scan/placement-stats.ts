import { quadArea, quadIou } from "../../packages/shared/src/scan/geometry.js";
import { centeredGuideQuad } from "../../packages/shared/src/scan/session-options.js";
import type { Quad } from "../../packages/shared/src/scan/types.js";

const IOU_BUCKETS = [0.1, 0.2, 0.3, 0.5, 0.7];
const BUCKET_LABELS = ["<0.1", "0.1-0.2", "0.2-0.3", "0.3-0.5", "0.5-0.7", ">=0.7"];

export interface PlacementStats {
  frames: number;
  buckets: number[];
  guideFallback: number;
  iouSum: number;
  containmentSum: number;
}

export function createPlacementStats(): PlacementStats {
  return {
    frames: 0,
    buckets: Array.from({ length: IOU_BUCKETS.length + 1 }, () => 0),
    guideFallback: 0,
    iouSum: 0,
    containmentSum: 0,
  };
}

export function recordPlacement(
  stats: PlacementStats,
  quad: Quad,
  width: number,
  height: number,
): void {
  const guide = centeredGuideQuad(width, height);
  const iou = quadIou(quad, guide);
  const candidateArea = quadArea(quad);
  const intersection = (iou * (candidateArea + quadArea(guide))) / (1 + iou);

  stats.frames++;
  stats.iouSum += iou;
  stats.containmentSum += candidateArea > 0 ? intersection / candidateArea : 0;
  if (quad.every((point, index) => point.x === guide[index].x && point.y === guide[index].y)) {
    stats.guideFallback++;
  }
  const bucket = IOU_BUCKETS.findIndex((edge) => iou < edge);
  stats.buckets[bucket === -1 ? IOU_BUCKETS.length : bucket]++;
}

export function formatPlacement(stats: PlacementStats): string {
  if (stats.frames === 0) {
    return "";
  }
  const histogram = stats.buckets
    .map((count, index) => `${BUCKET_LABELS[index]}: ${count}`)
    .join("  ");
  return (
    `  placement vs guide (${stats.frames} frames with a candidate): ` +
    `mean IoU ${(stats.iouSum / stats.frames).toFixed(2)}, ` +
    `mean containment ${(stats.containmentSum / stats.frames).toFixed(2)}, ` +
    `${stats.guideFallback} guide-fallback frames\n` +
    `    IoU histogram: ${histogram}\n`
  );
}
