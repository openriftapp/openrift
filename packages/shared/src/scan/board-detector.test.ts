import { describe, expect, it } from "vitest";

import {
  BOARD_DETECTOR_SIZE,
  BOARD_DETECTOR_STRIDE,
  fillBoardDetectorInput,
  boardDetectorCandidates,
} from "./board-detector";
import { boundingBox } from "./geometry";

const CELLS = BOARD_DETECTOR_SIZE / BOARD_DETECTOR_STRIDE;
const PLANE = CELLS * CELLS;

function maps(cards: { cx: number; cy: number; halfW: number; halfH: number; value?: number }[]) {
  const center = new Float32Array(PLANE);
  const corner = new Float32Array(PLANE);
  const offsets = new Float32Array(8 * PLANE);
  for (const card of cards) {
    const index = card.cy * CELLS + card.cx;
    center[index] = card.value ?? 0.9;
    const corners = [
      [-card.halfW, -card.halfH],
      [card.halfW, -card.halfH],
      [card.halfW, card.halfH],
      [-card.halfW, card.halfH],
    ];
    corners.forEach(([dx, dy], k) => {
      offsets[2 * k * PLANE + index] = (dx ?? 0) / 32;
      offsets[(2 * k + 1) * PLANE + index] = (dy ?? 0) / 32;
    });
  }
  return { center, corner, offsets };
}

describe("fillBoardDetectorInput", () => {
  it("letterboxes a portrait frame with equal side bars", () => {
    const frame = { data: new Uint8ClampedArray(480 * 848 * 4).fill(255), width: 480, height: 848 };
    const input = new Float32Array(3 * PLANE * BOARD_DETECTOR_STRIDE ** 2);
    const box = fillBoardDetectorInput(frame, input);
    expect(box.scale).toBeCloseTo(384 / 848, 6);
    expect(box.offsetY).toBeCloseTo(0, 6);
    expect(box.offsetX).toBeCloseTo((384 - 480 * box.scale) / 2, 6);
    expect(input[0]).toBe(0.5);
    expect(input[192]).toBe(1);
  });
});

describe("boardDetectorCandidates", () => {
  const frame = { width: 384, height: 384 };
  const identity = { scale: 1, offsetX: 0, offsetY: 0 };

  it("returns one quad per centre peak, strongest first", () => {
    const { center, corner, offsets } = maps([
      { cx: 20, cy: 20, halfW: 8, halfH: 11, value: 0.6 },
      { cx: 60, cy: 60, halfW: 8, halfH: 11, value: 0.9 },
    ]);
    const candidates = boardDetectorCandidates(frame, identity, center, corner, offsets);
    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.score).toBeCloseTo(0.9, 6);
    const quad = candidates[0]?.quad;
    expect(quad && boundingBox(quad)).toEqual({
      minX: (60.5 - 8) * 4,
      minY: (60.5 - 11) * 4,
      maxX: (60.5 + 8) * 4,
      maxY: (60.5 + 11) * 4,
    });
  });

  it("maps cells back through the letterbox into frame pixels", () => {
    const { center, corner, offsets } = maps([{ cx: 48, cy: 48, halfW: 8, halfH: 11 }]);
    const candidates = boardDetectorCandidates(
      { width: 768, height: 768 },
      { scale: 0.5, offsetX: 0, offsetY: 0 },
      center,
      corner,
      offsets,
    );
    const xs = candidates[0]?.quad.map((p) => p.x) ?? [];
    expect(Math.min(...xs)).toBeCloseTo((48.5 - 8) * 4 * 2, 6);
  });

  it("returns one quad for a centre peak spread evenly over two cells", () => {
    const { center, corner, offsets } = maps([
      { cx: 40, cy: 40, halfW: 8, halfH: 11 },
      { cx: 41, cy: 40, halfW: 8, halfH: 11 },
    ]);
    expect(boardDetectorCandidates(frame, identity, center, corner, offsets)).toHaveLength(1);
  });

  it("ignores centres below the threshold", () => {
    const { center, corner, offsets } = maps([{ cx: 20, cy: 20, halfW: 8, halfH: 11, value: 0.2 }]);
    expect(boardDetectorCandidates(frame, identity, center, corner, offsets)).toEqual([]);
  });

  it("keeps the regressed corner's sub-cell position without corner heat", () => {
    const { center, corner, offsets } = maps([{ cx: 40, cy: 40, halfW: 8.3, halfH: 11.6 }]);
    const candidate = boardDetectorCandidates(frame, identity, center, corner, offsets)[0];
    const topLeft = candidate?.quad.reduce((best, p) => (p.x + p.y < best.x + best.y ? p : best));
    expect(topLeft?.x).toBeCloseTo((40.5 - 8.3) * 4, 4);
    expect(topLeft?.y).toBeCloseTo((40.5 - 11.6) * 4, 4);
  });

  it("pulls a corner onto the corner heat's centroid within a cell", () => {
    const { center, corner, offsets } = maps([{ cx: 40, cy: 40, halfW: 8, halfH: 11 }]);
    corner[(40 - 11) * CELLS + (40 - 8)] = 0.8;
    corner[(40 - 11) * CELLS + (40 - 8 + 1)] = 0.8;
    const candidate = boardDetectorCandidates(frame, identity, center, corner, offsets)[0];
    const topLeft = candidate?.quad.reduce((best, p) => (p.x + p.y < best.x + best.y ? p : best));
    expect(topLeft).toEqual({ x: (40 - 8 + 1) * 4, y: (40 - 11 + 0.5) * 4 });
  });
});
