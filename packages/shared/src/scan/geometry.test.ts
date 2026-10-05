import { describe, expect, it } from "vitest";

import {
  applyHomography,
  boundingBox,
  candidateFromQuad,
  canonicalizeQuad,
  computeHomography,
  quadArea,
  quadCenter,
  intersectLines,
  mapQuad,
  quadIou,
  subPixelMinimum,
  touchesFrameEdge,
} from "./geometry";
import type { Quad } from "./types";

const UNIT_SQUARE: Quad = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe("canonicalizeQuad", () => {
  it("starts on a short side so the long axis maps to vertical", () => {
    const portrait: Quad = [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 90 },
      { x: 0, y: 90 },
    ];
    const ordered = canonicalizeQuad(portrait);
    const first = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y);
    const second = Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y);
    expect(first).toBeLessThan(second);
  });

  it("also starts on a short side for a landscape quad", () => {
    const landscape: Quad = [
      { x: 0, y: 0 },
      { x: 90, y: 0 },
      { x: 90, y: 60 },
      { x: 0, y: 60 },
    ];
    const ordered = canonicalizeQuad(landscape);
    const first = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y);
    const second = Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y);
    expect(first).toBeLessThan(second);
  });
});

describe("computeHomography", () => {
  it("maps each source corner onto its target", () => {
    const target: Quad = [
      { x: 5, y: 3 },
      { x: 40, y: 8 },
      { x: 38, y: 55 },
      { x: 2, y: 48 },
    ];
    const h = computeHomography(UNIT_SQUARE, target);
    expect(h).not.toBeNull();
    for (let i = 0; i < 4; i++) {
      const mapped = applyHomography(h as never, UNIT_SQUARE[i]!);
      expect(mapped.x).toBeCloseTo(target[i]!.x, 5);
      expect(mapped.y).toBeCloseTo(target[i]!.y, 5);
    }
  });

  it("returns null for a degenerate quad", () => {
    const degenerate: Quad = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    expect(computeHomography(degenerate, UNIT_SQUARE)).toBeNull();
  });
});

describe("quadIou", () => {
  it("is one for identical quads", () => {
    expect(quadIou(UNIT_SQUARE, UNIT_SQUARE)).toBeCloseTo(1, 6);
  });

  it("is zero for disjoint quads", () => {
    const far: Quad = [
      { x: 100, y: 100 },
      { x: 110, y: 100 },
      { x: 110, y: 110 },
      { x: 100, y: 110 },
    ];
    expect(quadIou(UNIT_SQUARE, far)).toBe(0);
  });

  it("is a third for quads overlapping on half their area", () => {
    const shifted: Quad = [
      { x: 5, y: 0 },
      { x: 15, y: 0 },
      { x: 15, y: 10 },
      { x: 5, y: 10 },
    ];
    expect(quadIou(UNIT_SQUARE, shifted)).toBeCloseTo(50 / 150, 6);
  });
});

describe("boundingBox", () => {
  it("covers every corner", () => {
    expect(boundingBox(UNIT_SQUARE)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });
});

describe("quadArea", () => {
  it("measures a square", () => {
    expect(quadArea(UNIT_SQUARE)).toBe(100);
  });

  it("ignores the winding direction", () => {
    const [a, b, c, d] = UNIT_SQUARE;
    expect(quadArea([d, c, b, a])).toBe(100);
  });

  it("is zero for a collapsed quad", () => {
    const point = { x: 3, y: 4 };
    expect(quadArea([point, point, point, point])).toBe(0);
  });
});

describe("quadCenter", () => {
  it("averages the four corners", () => {
    expect(quadCenter(UNIT_SQUARE)).toEqual({ x: 5, y: 5 });
  });

  it("follows a skewed quad's corners", () => {
    const skewed: Quad = [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 12, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(quadCenter(skewed)).toEqual({ x: 5, y: 2 });
  });
});

describe("touchesFrameEdge", () => {
  const shifted = (dx: number, dy: number): Quad =>
    mapQuad(UNIT_SQUARE, (point) => ({ x: point.x + dx, y: point.y + dy }));

  it("is false for a quad well inside the frame", () => {
    expect(touchesFrameEdge(shifted(20, 20), 100, 100, 5)).toBe(false);
  });

  it("is true when a corner is within the margin of any edge", () => {
    expect(touchesFrameEdge(shifted(2, 20), 100, 100, 5)).toBe(true);
    expect(touchesFrameEdge(shifted(20, 2), 100, 100, 5)).toBe(true);
    expect(touchesFrameEdge(shifted(88, 20), 100, 100, 5)).toBe(true);
    expect(touchesFrameEdge(shifted(20, 88), 100, 100, 5)).toBe(true);
  });

  it("treats a corner exactly at the margin as inside the frame", () => {
    expect(touchesFrameEdge(shifted(5, 5), 100, 100, 5)).toBe(false);
    expect(touchesFrameEdge(shifted(85, 85), 100, 100, 5)).toBe(false);
  });
});

describe("candidateFromQuad", () => {
  it("measures an upright card against the frame", () => {
    const card: Quad = [
      { x: 10, y: 10 },
      { x: 73, y: 10 },
      { x: 73, y: 98 },
      { x: 10, y: 98 },
    ];
    const candidate = candidateFromQuad(card, 200, 100, 0.9);

    expect(candidate.areaFraction).toBeCloseTo((63 * 88) / (200 * 100));
    expect(candidate.score).toBe(0.9);
  });

  it("puts the corners in canonical order", () => {
    const shuffled: Quad = [UNIT_SQUARE[2], UNIT_SQUARE[0], UNIT_SQUARE[3], UNIT_SQUARE[1]];
    expect(candidateFromQuad(shuffled, 10, 10, 1).quad).toEqual(canonicalizeQuad(shuffled));
  });
});

describe("mapQuad", () => {
  it("maps each corner with its index", () => {
    expect(mapQuad(UNIT_SQUARE, (point, index) => ({ x: point.x + index, y: point.y }))).toEqual([
      { x: 0, y: 0 },
      { x: 11, y: 0 },
      { x: 12, y: 10 },
      { x: 3, y: 10 },
    ]);
  });
});

describe("intersectLines", () => {
  it("meets a horizontal and a vertical line at their crossing", () => {
    const horizontal = { point: { x: 0, y: 4 }, direction: { x: 1, y: 0 } };
    const vertical = { point: { x: 7, y: 0 }, direction: { x: 0, y: 1 } };
    expect(intersectLines(horizontal, vertical)).toEqual({ x: 7, y: 4 });
  });

  it("returns null for parallel lines", () => {
    const first = { point: { x: 0, y: 0 }, direction: { x: 1, y: 0 } };
    const second = { point: { x: 0, y: 5 }, direction: { x: 1, y: 0 } };
    expect(intersectLines(first, second)).toBeNull();
  });
});

describe("subPixelMinimum", () => {
  it("finds the vertex of a parabola sampled around its minimum", () => {
    const cost = (x: number) => (x - 0.3) ** 2;
    expect(subPixelMinimum(cost(-1), cost(0), cost(1))).toBeCloseTo(0.3, 6);
  });

  it("is zero for a flat or downward-curving trio", () => {
    expect(subPixelMinimum(5, 5, 5)).toBe(0);
    expect(subPixelMinimum(1, 3, 2)).toBe(0);
  });

  it("clamps to half a step", () => {
    expect(subPixelMinimum(10, 1, 0)).toBe(0.5);
    expect(subPixelMinimum(0, 1, 10)).toBe(-0.5);
  });

  it("is zero when a neighbour is not a number", () => {
    expect(subPixelMinimum(Number.NaN, 1, 2)).toBe(0);
  });
});
