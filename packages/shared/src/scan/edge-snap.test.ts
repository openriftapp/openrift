import { describe, expect, it } from "vitest";

import { snapQuadToEdges } from "./edge-snap";
import type { GrayImage, Quad } from "./types";

function cardImage(left: number, top: number, right: number, bottom: number): GrayImage {
  const width = 300;
  const height = 400;
  const data = new Uint8Array(width * height).fill(20);
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      data[y * width + x] = 220;
    }
  }
  return { data, width, height };
}

const quad = (left: number, top: number, right: number, bottom: number): Quad => [
  { x: left, y: top },
  { x: right, y: top },
  { x: right, y: bottom },
  { x: left, y: bottom },
];

describe("snapQuadToEdges", () => {
  it("moves an outline a few pixels off onto the card edges", () => {
    const gray = cardImage(60, 50, 240, 300);
    const snapped = snapQuadToEdges(gray, quad(64, 46, 237, 305));
    const expected = quad(60, 50, 240, 300);
    for (const [index, point] of snapped.entries()) {
      expect(Math.abs(point.x - (expected[index]?.x ?? 0))).toBeLessThanOrEqual(0.6);
      expect(Math.abs(point.y - (expected[index]?.y ?? 0))).toBeLessThanOrEqual(0.6);
    }
  });

  it("never returns a corner that is not a number", () => {
    const gray = cardImage(60, 50, 240, 300);
    for (const size of [1, 1.5, 2, 3]) {
      const snapped = snapQuadToEdges(gray, quad(59, 49, 59 + size, 49 + size));
      expect(snapped.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(
        true,
      );
    }
  });

  it("keeps the outline when there is no edge nearby", () => {
    const gray: GrayImage = { data: new Uint8Array(300 * 400).fill(90), width: 300, height: 400 };
    const input = quad(60, 50, 240, 300);
    expect(snapQuadToEdges(gray, input)).toBe(input);
  });
});
