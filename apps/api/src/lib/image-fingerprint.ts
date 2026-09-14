export const FINGERPRINT_SHORT_EDGE = 400;
export const FINGERPRINT_LONG_EDGE = 560;
export const WHOLE_HASH_COLS = 9;
export const WHOLE_HASH_ROWS = 8;

/** Rarity dot or promo stamp at the bottom centre of the card, in card-space fractions. */
export const MARK_BOX = { x0: 0.44, x1: 0.56, y0: 0.9, y1: 0.975 } as const;
export const MARK_WIDTH = 48;
export const MARK_HEIGHT = 28;
export const MARK_SHIFT = 3;
export const MARK_STORED_WIDTH = MARK_WIDTH + 2 * MARK_SHIFT;
export const MARK_STORED_HEIGHT = MARK_HEIGHT + 2 * MARK_SHIFT;

const WHOLE_HASH_BYTES = 8;
const HEADER_BYTES = 2;
const VERSION = 1;

/** Calibrated on the catalog: rehosted copies stay at or below 5 bits, unrelated cards start at 10. */
const WHOLE_SAME_MAX_BITS = 8;
/** Calibrated on the catalog: rehosted copies stay below 0.75, stamped variants start at 1.48. */
const MARK_DIFFERS_MIN = 1.3;

export type ImageMatch = "same" | "art" | "mark";

export interface ImageFingerprint {
  landscape: boolean;
  hash: Uint8Array;
  mark: Uint8Array;
}

export function encodeFingerprint(fingerprint: ImageFingerprint): string {
  const bytes = new Uint8Array(HEADER_BYTES + WHOLE_HASH_BYTES + fingerprint.mark.length);
  bytes[0] = VERSION;
  bytes[1] = fingerprint.landscape ? 1 : 0;
  bytes.set(fingerprint.hash, HEADER_BYTES);
  bytes.set(fingerprint.mark, HEADER_BYTES + WHOLE_HASH_BYTES);
  return Buffer.from(bytes).toString("base64");
}

export function decodeFingerprint(encoded: string): ImageFingerprint | null {
  const bytes = Buffer.from(encoded, "base64");
  const expected = HEADER_BYTES + WHOLE_HASH_BYTES + MARK_STORED_WIDTH * MARK_STORED_HEIGHT;
  if (bytes.length !== expected || bytes[0] !== VERSION) {
    return null;
  }
  return {
    landscape: bytes[1] === 1,
    hash: new Uint8Array(bytes.subarray(HEADER_BYTES, HEADER_BYTES + WHOLE_HASH_BYTES)),
    mark: new Uint8Array(bytes.subarray(HEADER_BYTES + WHOLE_HASH_BYTES)),
  };
}

export function differenceHash(grid: Uint8Array, cols: number, rows: number): Uint8Array {
  const bits = new Uint8Array(Math.ceil(((cols - 1) * rows) / 8));
  let index = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const left = grid[r * cols + c] ?? 0;
      const right = grid[r * cols + c + 1] ?? 0;
      if (left < right) {
        bits[index >> 3] = (bits[index >> 3] ?? 0) | (1 << (index & 7));
      }
      index++;
    }
  }
  return bits;
}

export function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = (a[i] ?? 0) ^ (b[i] ?? 0);
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

function standardize(values: Uint8Array): Float32Array {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance) || 1;
  return Float32Array.from(values, (v) => (v - mean) / sd);
}

export function markDistance(a: Uint8Array, b: Uint8Array): number {
  const za = standardize(a);
  const zb = standardize(b);
  const W = MARK_STORED_WIDTH;
  const H = MARK_STORED_HEIGHT;
  const p = MARK_SHIFT;
  let bestMean = Infinity;
  let bestTop = Infinity;
  const diffs = new Float32Array((W - 2 * p) * (H - 2 * p));
  const topCount = Math.ceil(diffs.length / 10);
  for (let dy = -p; dy <= p; dy++) {
    for (let dx = -p; dx <= p; dx++) {
      let sum = 0;
      let n = 0;
      for (let y = p; y < H - p; y++) {
        for (let x = p; x < W - p; x++) {
          const d = Math.abs((za[y * W + x] ?? 0) - (zb[(y + dy) * W + x + dx] ?? 0));
          diffs[n++] = d;
          sum += d;
        }
      }
      const mean = sum / n;
      if (mean < bestMean) {
        bestMean = mean;
        const sorted = diffs.toSorted((u, v) => v - u);
        let top = 0;
        for (let i = 0; i < topCount; i++) {
          top += sorted[i] ?? 0;
        }
        bestTop = top / topCount;
      }
    }
  }
  return bestTop;
}

export function wholeDistance(a: ImageFingerprint, b: ImageFingerprint): number {
  return hammingDistance(a.hash, b.hash);
}

export function classifyImageMatch(a: ImageFingerprint, b: ImageFingerprint): ImageMatch {
  if (a.landscape !== b.landscape || wholeDistance(a, b) > WHOLE_SAME_MAX_BITS) {
    return "art";
  }
  return markDistance(a.mark, b.mark) >= MARK_DIFFERS_MIN ? "mark" : "same";
}

export function classifyAgainstLive(
  candidate: string | null,
  live: readonly (string | null)[],
): ImageMatch | null {
  const decoded = typeof candidate === "string" ? decodeFingerprint(candidate) : null;
  if (!decoded) {
    return null;
  }
  let best: ImageMatch | null = null;
  for (const encoded of live) {
    const fingerprint = encoded === null ? null : decodeFingerprint(encoded);
    if (!fingerprint) {
      continue;
    }
    const match = classifyImageMatch(decoded, fingerprint);
    if (match === "same") {
      return "same";
    }
    if (best === null || (best === "art" && match === "mark")) {
      best = match;
    }
  }
  return best;
}
