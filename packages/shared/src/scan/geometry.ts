import type { CardCandidate, Matrix3, Point, Quad } from "./types";

export interface Line {
  point: Point;
  direction: Point;
}

export function intersectLines(first: Line, second: Line): Point | null {
  const cross = first.direction.x * second.direction.y - first.direction.y * second.direction.x;
  if (Math.abs(cross) < 1e-6) {
    return null;
  }
  const dx = second.point.x - first.point.x;
  const dy = second.point.y - first.point.y;
  const t = (dx * second.direction.y - dy * second.direction.x) / cross;
  return { x: first.point.x + first.direction.x * t, y: first.point.y + first.direction.y * t };
}

export function mapQuad(quad: Quad, fn: (point: Point, index: number) => Point): Quad {
  return [fn(quad[0], 0), fn(quad[1], 1), fn(quad[2], 2), fn(quad[3], 3)];
}

export function subPixelMinimum(before: number, at: number, after: number): number {
  const curvature = before - 2 * at + after;
  if (!Number.isFinite(curvature) || curvature <= 0) {
    return 0;
  }
  return Math.max(-0.5, Math.min(0.5, (before - after) / (2 * curvature)));
}

/**
 * Put a quad into canonical order: clockwise, starting on a short side, so the
 * card's long axis lands vertically. Leaves a 180-degree ambiguity for the
 * matcher to resolve by scoring both.
 */
export function canonicalizeQuad(quad: Quad): Quad {
  const { x: cx, y: cy } = quadCenter(quad);
  const ordered: [Point, Point, Point, Point] = [quad[0], quad[1], quad[2], quad[3]];
  ordered.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));

  const side = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);
  const pairA = side(ordered[0], ordered[1]) + side(ordered[2], ordered[3]);
  const pairB = side(ordered[1], ordered[2]) + side(ordered[3], ordered[0]);
  if (pairA <= pairB) {
    return ordered;
  }
  return [ordered[1], ordered[2], ordered[3], ordered[0]];
}

/** Direct linear transform for four point correspondences, with h33 pinned to 1. */
export function computeHomography(from: Quad, to: Quad): Matrix3 | null {
  const pairs: readonly (readonly [Point, Point])[] = [
    [from[0], to[0]],
    [from[1], to[1]],
    [from[2], to[2]],
    [from[3], to[3]],
  ];
  const augmented: number[][] = [];
  for (const [source, target] of pairs) {
    const { x, y } = source;
    const { x: u, y: v } = target;
    augmented.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  const h = solveLinearSystem(augmented);
  if (!h) {
    return null;
  }
  const [h0, h1, h2, h3, h4, h5, h6, h7] = h;
  if (
    h0 === undefined ||
    h1 === undefined ||
    h2 === undefined ||
    h3 === undefined ||
    h4 === undefined ||
    h5 === undefined ||
    h6 === undefined ||
    h7 === undefined
  ) {
    return null;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7, 1];
}

/** Gauss-Jordan on an n-by-(n+1) augmented matrix, mutated in place. */
function solveLinearSystem(m: number[][]): number[] | null {
  const n = m.length;

  for (let col = 0; col < n; col++) {
    let pivot = col;
    let pivotMagnitude = Math.abs(m[col]?.[col] ?? 0);
    for (let row = col + 1; row < n; row++) {
      const magnitude = Math.abs(m[row]?.[col] ?? 0);
      if (magnitude > pivotMagnitude) {
        pivot = row;
        pivotMagnitude = magnitude;
      }
    }
    if (pivotMagnitude < 1e-10) {
      return null;
    }
    const head = m[col];
    const pivotRow = m[pivot];
    if (!head || !pivotRow) {
      return null;
    }
    m[col] = pivotRow;
    m[pivot] = head;
    const pivotValue = pivotRow[col];
    if (pivotValue === undefined) {
      return null;
    }
    for (const [row, target] of m.entries()) {
      if (row === col) {
        continue;
      }
      const leading = target[col];
      if (leading === undefined) {
        return null;
      }
      const factor = leading / pivotValue;
      if (factor === 0) {
        continue;
      }
      for (let k = col; k <= n; k++) {
        const value = target[k];
        const above = pivotRow[k];
        if (value === undefined || above === undefined) {
          return null;
        }
        target[k] = value - factor * above;
      }
    }
  }

  const solution: number[] = [];
  for (const [i, row] of m.entries()) {
    const rhs = row[n];
    const diagonal = row[i];
    if (rhs === undefined || diagonal === undefined) {
      return null;
    }
    solution.push(rhs / diagonal);
  }
  return solution;
}

export function applyHomography(h: Matrix3, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

/** Intersection-over-union of two quads, approximated on their axis-aligned bounding boxes. */
export function quadIou(a: Quad, b: Quad): number {
  const boxA = boundingBox(a);
  const boxB = boundingBox(b);
  const x1 = Math.max(boxA.minX, boxB.minX);
  const y1 = Math.max(boxA.minY, boxB.minY);
  const x2 = Math.min(boxA.maxX, boxB.maxX);
  const y2 = Math.min(boxA.maxY, boxB.maxY);
  if (x2 <= x1 || y2 <= y1) {
    return 0;
  }
  const overlap = (x2 - x1) * (y2 - y1);
  const areaA = (boxA.maxX - boxA.minX) * (boxA.maxY - boxA.minY);
  const areaB = (boxB.maxX - boxB.minX) * (boxB.maxY - boxB.minY);
  return overlap / (areaA + areaB - overlap);
}

export function boundingBox(quad: Quad): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of quad) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function quadArea(quad: Quad): number {
  let twice = 0;
  for (let index = 0; index < 4; index++) {
    const a = quad[index] as Point;
    const b = quad[(index + 1) % 4] as Point;
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

export function quadCenter(quad: Quad): Point {
  return {
    x: (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4,
    y: (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4,
  };
}

export function touchesFrameEdge(
  quad: Quad,
  width: number,
  height: number,
  margin: number,
): boolean {
  return quad.some(
    (point) =>
      point.x < margin || point.y < margin || point.x > width - margin || point.y > height - margin,
  );
}

export function candidateFromQuad(
  quad: Quad,
  frameWidth: number,
  frameHeight: number,
  score: number,
): CardCandidate {
  const ordered = canonicalizeQuad(quad);
  const side = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
  const width = (side(ordered[0], ordered[1]) + side(ordered[3], ordered[2])) / 2;
  const height = (side(ordered[0], ordered[3]) + side(ordered[1], ordered[2])) / 2;
  return {
    quad: ordered,
    areaFraction: (width * height) / (frameWidth * frameHeight),
    score,
  };
}
