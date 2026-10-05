/**
 * Decoding for the learned multi-card detector: the letterboxed input, and
 * card quads from its centre heatmap, corner heatmap and per-centre corner
 * offsets.
 */
import { candidateFromQuad } from "./geometry";
import { heatmapPeaks } from "./heatmap";
import type { CardCandidate, Point, RgbaImage } from "./types";

export const BOARD_DETECTOR_SIZE = 384;
/** Model output stride, in input pixels. */
export const BOARD_DETECTOR_STRIDE = 4;
const CELLS = BOARD_DETECTOR_SIZE / BOARD_DETECTOR_STRIDE;
const CENTER_THRESHOLD = 0.35;
const CORNER_SNAP_RADIUS = 1;
const CORNER_SNAP_MIN = 0.3;
/** Offsets are trained in cells divided by this. */
const OFFSET_SCALE = 32;

export interface Letterbox {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Fits the frame into the square input, centred, and fills `input` (planar RGB, 0..1). */
export function fillBoardDetectorInput(frame: RgbaImage, input: Float32Array): Letterbox {
  const scale = BOARD_DETECTOR_SIZE / Math.max(frame.width, frame.height);
  const offsetX = (BOARD_DETECTOR_SIZE - frame.width * scale) / 2;
  const offsetY = (BOARD_DETECTOR_SIZE - frame.height * scale) / 2;
  const plane = BOARD_DETECTOR_SIZE * BOARD_DETECTOR_SIZE;
  input.fill(0.5);
  for (let y = 0; y < BOARD_DETECTOR_SIZE; y++) {
    const sy = Math.floor((y + 0.5 - offsetY) / scale);
    if (sy < 0 || sy >= frame.height) {
      continue;
    }
    for (let x = 0; x < BOARD_DETECTOR_SIZE; x++) {
      const sx = Math.floor((x + 0.5 - offsetX) / scale);
      if (sx < 0 || sx >= frame.width) {
        continue;
      }
      const source = (sy * frame.width + sx) * 4;
      const target = y * BOARD_DETECTOR_SIZE + x;
      input[target] = (frame.data[source] ?? 0) / 255;
      input[plane + target] = (frame.data[source + 1] ?? 0) / 255;
      input[2 * plane + target] = (frame.data[source + 2] ?? 0) / 255;
    }
  }
  return { scale, offsetX, offsetY };
}

function refineCorner(corner: Point, cornerHeat: Float32Array): Point {
  const cx = Math.round(corner.x - 0.5);
  const cy = Math.round(corner.y - 0.5);
  let sum = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = cy - CORNER_SNAP_RADIUS; y <= cy + CORNER_SNAP_RADIUS; y++) {
    for (let x = cx - CORNER_SNAP_RADIUS; x <= cx + CORNER_SNAP_RADIUS; x++) {
      if (x < 0 || y < 0 || x >= CELLS || y >= CELLS) {
        continue;
      }
      const value = cornerHeat[y * CELLS + x] ?? 0;
      if (value >= CORNER_SNAP_MIN) {
        sum += value;
        sumX += value * (x + 0.5);
        sumY += value * (y + 0.5);
      }
    }
  }
  return sum > 0 ? { x: sumX / sum, y: sumY / sum } : corner;
}

/** In frame pixels. */
export function boardDetectorCandidates(
  frame: { width: number; height: number },
  letterbox: Letterbox,
  centerHeat: Float32Array,
  cornerHeat: Float32Array,
  offsets: Float32Array,
): CardCandidate[] {
  const plane = CELLS * CELLS;
  const peaks = heatmapPeaks(centerHeat, CELLS, CELLS, CENTER_THRESHOLD);
  const toFrame = (cell: Point): Point => ({
    x: (cell.x * BOARD_DETECTOR_STRIDE - letterbox.offsetX) / letterbox.scale,
    y: (cell.y * BOARD_DETECTOR_STRIDE - letterbox.offsetY) / letterbox.scale,
  });
  return peaks.map((peak) => {
    const index = peak.y * CELLS + peak.x;
    const corner = (k: number): Point => {
      const raw = {
        x: peak.x + 0.5 + (offsets[2 * k * plane + index] ?? 0) * OFFSET_SCALE,
        y: peak.y + 0.5 + (offsets[(2 * k + 1) * plane + index] ?? 0) * OFFSET_SCALE,
      };
      return toFrame(refineCorner(raw, cornerHeat));
    };
    return candidateFromQuad(
      [corner(0), corner(1), corner(2), corner(3)],
      frame.width,
      frame.height,
      peak.value,
    );
  });
}
