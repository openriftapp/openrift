/**
 * Decoding for the learned single-card corner detector: the guide window it
 * reads, and the quad recovered from its corner heatmap.
 */
import { candidateFromQuad } from "./geometry";
import { heatmapPeaks } from "./heatmap";
import { centeredGuideQuad } from "./session-options";
import type { CardCandidate, Point, RgbaImage } from "./types";

export const CARD_DETECTOR_VIEW_WIDTH = 224;
export const CARD_DETECTOR_VIEW_HEIGHT = 320;
/** Model output stride, in view pixels. */
export const CARD_DETECTOR_STRIDE = 4;
const WINDOW_MARGIN = 1.25;
const PEAK_THRESHOLD = 0.3;
const PRESENT_THRESHOLD = 0.5;
/** Heatmap cells. */
const PEAK_SUPPRESSION = 4;

export interface DetectorWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** In frame pixels. */
export function detectorWindow(frameWidth: number, frameHeight: number): DetectorWindow {
  const guide = centeredGuideQuad(frameWidth, frameHeight);
  const guideHeight = guide[3].y - guide[0].y;
  const centerX = (guide[0].x + guide[1].x) / 2;
  const centerY = (guide[0].y + guide[3].y) / 2;
  const height = guideHeight * WINDOW_MARGIN;
  const width = (height * CARD_DETECTOR_VIEW_WIDTH) / CARD_DETECTOR_VIEW_HEIGHT;
  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}

export function cornersFromHeatmap(
  heat: Float32Array,
  width: number,
  height: number,
): Point[] | null {
  const peaks = heatmapPeaks(heat, width, height, PEAK_THRESHOLD);
  const kept: { x: number; y: number }[] = [];
  for (const peak of peaks) {
    if (kept.every((other) => Math.hypot(other.x - peak.x, other.y - peak.y) >= PEAK_SUPPRESSION)) {
      kept.push(peak);
    }
    if (kept.length === 4) {
      break;
    }
  }
  if (kept.length < 4) {
    return null;
  }
  const cx = kept.reduce((sum, p) => sum + p.x, 0) / 4;
  const cy = kept.reduce((sum, p) => sum + p.y, 0) / 4;
  const byAngle = kept.toSorted(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
  let start = 0;
  for (let i = 1; i < 4; i++) {
    const p = byAngle[i] as { x: number; y: number };
    const s = byAngle[start] as { x: number; y: number };
    if (p.x + p.y < s.x + s.y) {
      start = i;
    }
  }
  return [0, 1, 2, 3].map((offset) => {
    const p = byAngle[(start + offset) % 4] as { x: number; y: number };
    return { x: p.x + 0.5, y: p.y + 0.5 };
  });
}

export function fillCardDetectorInput(frame: RgbaImage, input: Float32Array): DetectorWindow {
  const window = detectorWindow(frame.width, frame.height);
  const plane = CARD_DETECTOR_VIEW_WIDTH * CARD_DETECTOR_VIEW_HEIGHT;
  const scaleX = window.width / CARD_DETECTOR_VIEW_WIDTH;
  const scaleY = window.height / CARD_DETECTOR_VIEW_HEIGHT;
  for (let y = 0; y < CARD_DETECTOR_VIEW_HEIGHT; y++) {
    const sy = Math.min(frame.height - 1, Math.max(0, Math.floor(window.y + (y + 0.5) * scaleY)));
    for (let x = 0; x < CARD_DETECTOR_VIEW_WIDTH; x++) {
      const sx = Math.min(frame.width - 1, Math.max(0, Math.floor(window.x + (x + 0.5) * scaleX)));
      const source = (sy * frame.width + sx) * 4;
      const target = y * CARD_DETECTOR_VIEW_WIDTH + x;
      input[target] = (frame.data[source] ?? 0) / 255;
      input[plane + target] = (frame.data[source + 1] ?? 0) / 255;
      input[2 * plane + target] = (frame.data[source + 2] ?? 0) / 255;
    }
  }
  return window;
}

export function cardDetectorCandidates(
  frame: { width: number; height: number },
  window: DetectorWindow,
  heat: Float32Array,
  present: number,
): CardCandidate[] {
  if (present < PRESENT_THRESHOLD) {
    return [];
  }
  const corners = cornersFromHeatmap(
    heat,
    CARD_DETECTOR_VIEW_WIDTH / CARD_DETECTOR_STRIDE,
    CARD_DETECTOR_VIEW_HEIGHT / CARD_DETECTOR_STRIDE,
  );
  return corners ? [candidateFromCorners(corners, window, frame.width, frame.height, present)] : [];
}

export function candidateFromCorners(
  corners: readonly Point[],
  window: DetectorWindow,
  frameWidth: number,
  frameHeight: number,
  score: number,
): CardCandidate {
  const scaleX = (CARD_DETECTOR_STRIDE * window.width) / CARD_DETECTOR_VIEW_WIDTH;
  const scaleY = (CARD_DETECTOR_STRIDE * window.height) / CARD_DETECTOR_VIEW_HEIGHT;
  const toFrame = (index: number): Point => {
    const corner = corners[index] ?? { x: 0, y: 0 };
    return { x: window.x + corner.x * scaleX, y: window.y + corner.y * scaleY };
  };
  return candidateFromQuad(
    [toFrame(0), toFrame(1), toFrame(2), toFrame(3)],
    frameWidth,
    frameHeight,
    score,
  );
}
