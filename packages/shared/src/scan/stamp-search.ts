/**
 * Finds a printed marker (promo stamp) near the bottom centre of a card crop by sliding the
 * marked and plain references' stamp box over a wide window, so a few percent of outline error
 * does not move the stamp out of view. Both are then compared on the pixels where they differ.
 */
import { toGray } from "./image";
import type { RgbaImage } from "./types";

const CARD_WIDTH = 384;
const CARD_HEIGHT = 528;
const DOWNSCALE = 2;
const TEMPLATE_BOX = { x0: 0.4, y0: 0.875, x1: 0.6, y1: 0.965 };
const SEARCH_BOX = { x0: 0.28, y0: 0.8, x1: 0.72, y1: 0.995 };
const SCALES = [0.88, 1, 1.12];
const DIFFERENCE_SHARE = 0.2;
export const STAMP_MIN_SCORE = 0.7;
export const STAMP_MIN_LEAD = 0.1;

type Box = typeof TEMPLATE_BOX;

interface Raster {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

interface Plane extends Raster {
  data: Float32Array;
}

interface ScaledPair {
  marked: Plane;
  plain: Plane;
  mask: Uint8Array;
  markedCentered: Float32Array;
  plainCentered: Float32Array;
  markedNorm: number;
  plainNorm: number;
}

export interface StampPair {
  scales: ScaledPair[];
}

export interface StampScores {
  fit: number;
  marked: number;
  plain: number;
}

function cardGray(card: RgbaImage): Raster {
  const gray = toGray(card);
  return gray.width === CARD_WIDTH && gray.height === CARD_HEIGHT
    ? gray
    : resizePlane(gray, CARD_WIDTH, CARD_HEIGHT);
}

function cropPlane(src: Raster, box: Box): Plane {
  const x = Math.round(src.width * box.x0);
  const y = Math.round(src.height * box.y0);
  const width = Math.round(src.width * (box.x1 - box.x0));
  const height = Math.round(src.height * (box.y1 - box.y0));
  const data = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      data[row * width + col] = src.data[(y + row) * src.width + x + col] ?? 0;
    }
  }
  return { data, width, height };
}

function resizePlane(src: Raster, width: number, height: number): Plane {
  const data = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    const sy = Math.min(src.height - 1, Math.max(0, ((row + 0.5) * src.height) / height - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(src.height - 1, y0 + 1);
    const fy = sy - y0;
    for (let col = 0; col < width; col++) {
      const sx = Math.min(src.width - 1, Math.max(0, ((col + 0.5) * src.width) / width - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(src.width - 1, x0 + 1);
      const fx = sx - x0;
      const top =
        (src.data[y0 * src.width + x0] ?? 0) * (1 - fx) + (src.data[y0 * src.width + x1] ?? 0) * fx;
      const bottom =
        (src.data[y1 * src.width + x0] ?? 0) * (1 - fx) + (src.data[y1 * src.width + x1] ?? 0) * fx;
      data[row * width + col] = top * (1 - fy) + bottom * fy;
    }
  }
  return { data, width, height };
}

function edges(src: Plane): Plane {
  const { width, height } = src;
  const data = new Float32Array(width * height);
  const at = (x: number, y: number) =>
    src.data[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))] ??
    0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gx =
        at(x + 1, y - 1) +
        2 * at(x + 1, y) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x - 1, y) -
        at(x - 1, y + 1);
      const gy =
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1) -
        at(x - 1, y - 1) -
        2 * at(x, y - 1) -
        at(x + 1, y - 1);
      data[y * width + x] = Math.hypot(gx, gy);
    }
  }
  return { data, width, height };
}

function peak(plane: Plane): number {
  let max = 0;
  for (const value of plane.data) {
    max = Math.max(max, value);
  }
  return max || 1;
}

function correlationAt(
  search: Plane,
  template: Plane,
  x: number,
  y: number,
  mask: Uint8Array | null,
): number {
  let count = 0;
  let sumS = 0;
  let sumT = 0;
  let sumSS = 0;
  let sumTT = 0;
  let sumST = 0;
  for (let row = 0; row < template.height; row++) {
    const searchRow = (y + row) * search.width + x;
    const templateRow = row * template.width;
    for (let col = 0; col < template.width; col++) {
      if (mask && !mask[templateRow + col]) {
        continue;
      }
      const s = search.data[searchRow + col] ?? 0;
      const t = template.data[templateRow + col] ?? 0;
      count++;
      sumS += s;
      sumT += t;
      sumSS += s * s;
      sumTT += t * t;
      sumST += s * t;
    }
  }
  if (count < 8) {
    return -1;
  }
  const varS = sumSS - (sumS * sumS) / count;
  const varT = sumTT - (sumT * sumT) / count;
  if (varS <= 1e-6 || varT <= 1e-6) {
    return -1;
  }
  return (sumST - (sumS * sumT) / count) / Math.sqrt(varS * varT);
}

interface SearchPlane extends Plane {
  sums: Float64Array;
  squares: Float64Array;
}

function withSums(plane: Plane): SearchPlane {
  const stride = plane.width + 1;
  const sums = new Float64Array(stride * (plane.height + 1));
  const squares = new Float64Array(stride * (plane.height + 1));
  for (let y = 0; y < plane.height; y++) {
    let row = 0;
    let rowSquares = 0;
    for (let x = 0; x < plane.width; x++) {
      const value = plane.data[y * plane.width + x] ?? 0;
      row += value;
      rowSquares += value * value;
      sums[(y + 1) * stride + x + 1] = (sums[y * stride + x + 1] ?? 0) + row;
      squares[(y + 1) * stride + x + 1] = (squares[y * stride + x + 1] ?? 0) + rowSquares;
    }
  }
  return { ...plane, sums, squares };
}

function boxSum(
  table: Float64Array,
  stride: number,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  return (
    (table[(y + h) * stride + x + w] ?? 0) -
    (table[y * stride + x + w] ?? 0) -
    (table[(y + h) * stride + x] ?? 0) +
    (table[y * stride + x] ?? 0)
  );
}

function bestOfPair(search: SearchPlane, pair: ScaledPair, x: number, y: number): number {
  const { marked, markedCentered, plainCentered, markedNorm, plainNorm } = pair;
  const { width, height } = marked;
  const stride = search.width + 1;
  const count = width * height;
  const sum = boxSum(search.sums, stride, x, y, width, height);
  const variance = boxSum(search.squares, stride, x, y, width, height) - (sum * sum) / count;
  if (variance <= 1e-6 || markedNorm <= 1e-6 || plainNorm <= 1e-6) {
    return -1;
  }
  let dotMarked = 0;
  let dotPlain = 0;
  for (let row = 0; row < height; row++) {
    const searchRow = (y + row) * search.width + x;
    const templateRow = row * width;
    for (let col = 0; col < width; col++) {
      const value = search.data[searchRow + col] ?? 0;
      dotMarked += value * (markedCentered[templateRow + col] ?? 0);
      dotPlain += value * (plainCentered[templateRow + col] ?? 0);
    }
  }
  const spread = Math.sqrt(variance);
  return Math.max(dotMarked / (spread * markedNorm), dotPlain / (spread * plainNorm));
}

function centered(plane: Plane): { values: Float32Array; norm: number } {
  let mean = 0;
  for (const value of plane.data) {
    mean += value;
  }
  mean /= plane.data.length || 1;
  const values = new Float32Array(plane.data.length);
  let squares = 0;
  for (let index = 0; index < values.length; index++) {
    const value = (plane.data[index] ?? 0) - mean;
    values[index] = value;
    squares += value * value;
  }
  return { values, norm: Math.sqrt(squares) };
}

export function stampPair(plainReference: RgbaImage, markedReference: RgbaImage): StampPair {
  const plainBox = cropPlane(cardGray(plainReference), TEMPLATE_BOX);
  const markedBox = cropPlane(cardGray(markedReference), TEMPLATE_BOX);
  return {
    scales: SCALES.map((scale) => {
      const width = Math.round((plainBox.width * scale) / DOWNSCALE);
      const height = Math.round((plainBox.height * scale) / DOWNSCALE);
      const plain = edges(resizePlane(plainBox, width, height));
      const marked = edges(resizePlane(markedBox, width, height));
      const plainPeak = peak(plain);
      const markedPeak = peak(marked);
      const differs = new Uint8Array(width * height);
      for (let index = 0; index < differs.length; index++) {
        const gap = Math.abs(
          (marked.data[index] ?? 0) / markedPeak - (plain.data[index] ?? 0) / plainPeak,
        );
        differs[index] = gap > DIFFERENCE_SHARE ? 1 : 0;
      }
      const mask = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let on = 0;
          for (let dy = -1; dy <= 1 && !on; dy++) {
            for (let dx = -1; dx <= 1 && !on; dx++) {
              const yy = Math.min(height - 1, Math.max(0, y + dy));
              const xx = Math.min(width - 1, Math.max(0, x + dx));
              on = differs[yy * width + xx] ?? 0;
            }
          }
          mask[y * width + x] = on;
        }
      }
      const markedZero = centered(marked);
      const plainZero = centered(plain);
      return {
        marked,
        plain,
        mask,
        markedCentered: markedZero.values,
        plainCentered: plainZero.values,
        markedNorm: markedZero.norm,
        plainNorm: plainZero.norm,
      };
    }),
  };
}

/** `card` is an upright crop of the whole card; any size, scaled to the reference geometry. */
export function stampScores(card: RgbaImage, pair: StampPair): StampScores {
  const window = cropPlane(cardGray(card), SEARCH_BOX);
  const search = withSums(
    edges(
      resizePlane(
        window,
        Math.round(window.width / DOWNSCALE),
        Math.round(window.height / DOWNSCALE),
      ),
    ),
  );
  let best = { score: -2, x: 0, y: 0, scale: 0 };
  pair.scales.forEach((scaled, scale) => {
    for (let y = 0; y + scaled.marked.height <= search.height; y++) {
      for (let x = 0; x + scaled.marked.width <= search.width; x++) {
        const score = bestOfPair(search, scaled, x, y);
        if (score > best.score) {
          best = { score, x, y, scale };
        }
      }
    }
  });
  const found = pair.scales[best.scale];
  if (!found) {
    return { fit: -1, marked: -1, plain: -1 };
  }
  return {
    fit: best.score,
    marked: correlationAt(search, found.marked, best.x, best.y, found.mask),
    plain: correlationAt(search, found.plain, best.x, best.y, found.mask),
  };
}

export function showsStamp(scores: StampScores): boolean {
  return scores.marked >= STAMP_MIN_SCORE && scores.marked - scores.plain >= STAMP_MIN_LEAD;
}
