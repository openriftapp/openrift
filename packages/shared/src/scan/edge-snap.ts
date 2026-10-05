/**
 * Tightens a coarse card outline (from a learned detector) onto the image:
 * each side moves to the strongest nearby edge along its normal, and the
 * corners become the intersections of the refitted sides.
 */
import type { Line } from "./geometry";
import { intersectLines, mapQuad, subPixelMinimum } from "./geometry";
import type { GrayImage, Point, Quad } from "./types";

const SAMPLES_PER_SIDE = 24;
/** Share of the side's length. */
const CORNER_SKIP = 0.1;
/** Search radius as a fraction of the side's length. */
const RADIUS_FRACTION = 0.04;
const MIN_RADIUS = 3;
const OUTLIER_PX = 2;
/** Search radii. */
const MAX_CORNER_SHIFT = 2;
const CORNER_SLACK_PX = 2;

function sample(gray: GrayImage, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 + 1 >= gray.width || y0 + 1 >= gray.height) {
    return Number.NaN;
  }
  const fx = x - x0;
  const fy = y - y0;
  const index = y0 * gray.width + x0;
  const top = (gray.data[index] ?? 0) * (1 - fx) + (gray.data[index + 1] ?? 0) * fx;
  const bottom =
    (gray.data[index + gray.width] ?? 0) * (1 - fx) + (gray.data[index + gray.width + 1] ?? 0) * fx;
  return top * (1 - fy) + bottom * fy;
}

function fitSide(gray: GrayImage, a: Point, b: Point): Line | null {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 1) {
    return null;
  }
  const direction = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  const normal = { x: -direction.y, y: direction.x };
  const radius = Math.max(MIN_RADIUS, Math.round(length * RADIUS_FRACTION));
  const hits: { t: number; offset: number }[] = [];
  for (let index = 0; index < SAMPLES_PER_SIDE; index++) {
    const t = CORNER_SKIP + ((1 - 2 * CORNER_SKIP) * index) / (SAMPLES_PER_SIDE - 1);
    const base = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const strengths: number[] = [];
    for (let offset = -radius - 1; offset <= radius + 1; offset++) {
      const before = sample(
        gray,
        base.x + normal.x * (offset - 1),
        base.y + normal.y * (offset - 1),
      );
      const after = sample(
        gray,
        base.x + normal.x * (offset + 1),
        base.y + normal.y * (offset + 1),
      );
      strengths.push(Math.abs(after - before));
    }
    let best = 0;
    let bestOffset = Number.NaN;
    for (let step = 1; step < strengths.length - 1; step++) {
      const strength = strengths[step] ?? 0;
      if (strength > best) {
        best = strength;
        const left = strengths[step - 1] ?? 0;
        const right = strengths[step + 1] ?? 0;
        bestOffset = step - radius - 1 + subPixelMinimum(-left, -strength, -right);
      }
    }
    if (Number.isFinite(bestOffset)) {
      hits.push({ t, offset: bestOffset });
    }
  }
  if (hits.length < SAMPLES_PER_SIDE / 2) {
    return null;
  }
  const offsets = hits.map((hit) => hit.offset).toSorted((x, y) => x - y);
  const median = offsets[Math.floor(offsets.length / 2)] ?? 0;
  const agreeing = hits.filter((hit) => Math.abs(hit.offset - median) <= OUTLIER_PX);
  if (agreeing.length < SAMPLES_PER_SIDE / 2) {
    return null;
  }
  const n = agreeing.length;
  const meanT = agreeing.reduce((sum, hit) => sum + hit.t, 0) / n;
  const meanOffset = agreeing.reduce((sum, hit) => sum + hit.offset, 0) / n;
  let covariance = 0;
  let variance = 0;
  for (const hit of agreeing) {
    covariance += (hit.t - meanT) * (hit.offset - meanOffset);
    variance += (hit.t - meanT) ** 2;
  }
  const slope = variance > 0 ? covariance / variance : 0;
  const offsetAt = (t: number) => meanOffset + slope * (t - meanT);
  const start = {
    x: a.x + normal.x * offsetAt(0),
    y: a.y + normal.y * offsetAt(0),
  };
  const end = {
    x: b.x + normal.x * offsetAt(1),
    y: b.y + normal.y * offsetAt(1),
  };
  const fitted = Math.hypot(end.x - start.x, end.y - start.y);
  if (!(fitted > 1e-6)) {
    return null;
  }
  return {
    point: start,
    direction: { x: (end.x - start.x) / fitted, y: (end.y - start.y) / fitted },
  };
}

export function snapQuadToEdges(gray: GrayImage, quad: Quad): Quad {
  const lines: Line[] = [];
  for (let side = 0; side < 4; side++) {
    const line = fitSide(gray, quad[side] as Point, quad[(side + 1) % 4] as Point);
    if (!line) {
      return quad;
    }
    lines.push(line);
  }
  const snapped = mapQuad(quad, (original, corner) => {
    const point = intersectLines(lines[(corner + 3) % 4] as Line, lines[corner] as Line);
    const next = quad[(corner + 1) % 4] as Point;
    const side = Math.hypot(next.x - original.x, next.y - original.y);
    const maxShift = side * RADIUS_FRACTION * MAX_CORNER_SHIFT + CORNER_SLACK_PX;
    return point && Math.hypot(point.x - original.x, point.y - original.y) <= maxShift
      ? point
      : { x: Number.NaN, y: Number.NaN };
  });
  return snapped.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    ? snapped
    : quad;
}
