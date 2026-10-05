/** Patch-wise normalised correlation of a rectified card's grayscale thumbnail against its reference render. */
import { downscaleGray, rotateRgbaCw, toGray } from "./image";
import type { RgbaImage } from "./types";

export const ALIGNED_WIDTH = 40;
export const ALIGNED_HEIGHT = 56;
const PATCH = 10;
const STRIDE = 5;
/** Thumbnail pixels. */
const SHIFT = 2;
/** Grey levels squared. */
const MIN_PIXEL_VARIANCE = 4;
const MIN_TEXTURED_PATCH_SHARE = 1 / 3;
export const REFERENCE_CACHE_LIMIT = 256;

export interface AlignedSignature {
  data: Float32Array;
  width: number;
  height: number;
}

export function alignedSignature(image: RgbaImage, rotation = 0): AlignedSignature {
  let oriented = image;
  for (let turn = 0; turn < rotation % 4; turn++) {
    oriented = rotateRgbaCw(oriented);
  }
  const small = downscaleGray(toGray(oriented), ALIGNED_WIDTH, ALIGNED_HEIGHT);
  const data = new Float32Array(small.data.length);
  for (let i = 0; i < data.length; i++) {
    data[i] = small.data[i] ?? 0;
  }
  return { data, width: small.width, height: small.height };
}

function patchCorrelation(
  query: AlignedSignature,
  reference: AlignedSignature,
  x: number,
  y: number,
  dx: number,
  dy: number,
): number {
  let sumQ = 0;
  let sumR = 0;
  let sumQQ = 0;
  let sumRR = 0;
  let sumQR = 0;
  const n = PATCH * PATCH;
  for (let py = 0; py < PATCH; py++) {
    const ry = y + py;
    const qy = Math.min(query.height - 1, Math.max(0, ry + dy));
    for (let px = 0; px < PATCH; px++) {
      const rx = x + px;
      const qx = Math.min(query.width - 1, Math.max(0, rx + dx));
      const q = query.data[qy * query.width + qx] ?? 0;
      const r = reference.data[ry * reference.width + rx] ?? 0;
      sumQ += q;
      sumR += r;
      sumQQ += q * q;
      sumRR += r * r;
      sumQR += q * r;
    }
  }
  const varQ = sumQQ - (sumQ * sumQ) / n;
  const varR = sumRR - (sumR * sumR) / n;
  // Flat patches (plain borders, blown-out glare) carry no evidence either way.
  if (varQ < n * MIN_PIXEL_VARIANCE || varR < n * MIN_PIXEL_VARIANCE) {
    return Number.NaN;
  }
  return (sumQR - (sumQ * sumR) / n) / Math.sqrt(varQ * varR);
}

/** Landscape renders turn 90 degrees left, as in the canonical bank. */
export function referenceSignature(image: RgbaImage): AlignedSignature {
  return alignedSignature(image, image.width > image.height ? 3 : 0);
}

/** Median over patches of the best correlation within a small shift. */
export function alignedScore(query: AlignedSignature, reference: AlignedSignature): number {
  const scores: number[] = [];
  let patches = 0;
  for (let y = 0; y + PATCH <= reference.height; y += STRIDE) {
    for (let x = 0; x + PATCH <= reference.width; x += STRIDE) {
      patches++;
      let best = Number.NEGATIVE_INFINITY;
      for (let dy = -SHIFT; dy <= SHIFT; dy++) {
        for (let dx = -SHIFT; dx <= SHIFT; dx++) {
          const score = patchCorrelation(query, reference, x, y, dx, dy);
          if (score > best) {
            best = score;
          }
        }
      }
      if (Number.isFinite(best)) {
        scores.push(best);
      }
    }
  }
  if (scores.length < patches * MIN_TEXTURED_PATCH_SHARE) {
    return Number.NaN;
  }
  scores.sort((a, b) => a - b);
  return scores[Math.floor(scores.length / 2)] ?? Number.NaN;
}

interface AlignedVerification {
  scores: { key: string; score: number }[];
  failed: string[];
}

export type AlignedVerifier = (
  card: RgbaImage,
  shortlist: readonly { key: string; rotation: number }[],
) => Promise<AlignedVerification>;

/** Scores a card against its shortlist's renders, caching the most recently used ones. */
export function createAlignedVerifier(
  fetchReference: (key: string) => Promise<RgbaImage | null>,
  cacheLimit = REFERENCE_CACHE_LIMIT,
): AlignedVerifier {
  const references = new Map<string, AlignedSignature | null>();

  function remember(key: string, reference: AlignedSignature | null): void {
    references.delete(key);
    references.set(key, reference);
    if (references.size > cacheLimit) {
      const oldest = references.keys().next().value;
      if (oldest !== undefined) {
        references.delete(oldest);
      }
    }
  }

  return async (card, shortlist) => {
    const cached = new Map<string, AlignedSignature | null>();
    for (const { key } of shortlist) {
      if (references.has(key)) {
        cached.set(key, references.get(key) ?? null);
      }
    }
    const fetched = new Map<string, AlignedSignature | null>();
    const failed = new Set<string>();
    await Promise.all(
      shortlist
        .filter(({ key }) => !cached.has(key))
        .map(async ({ key }) => {
          try {
            const image = await fetchReference(key);
            fetched.set(key, image ? referenceSignature(image) : null);
          } catch {
            failed.add(key);
          }
        }),
    );
    const scores: { key: string; score: number }[] = [];
    const queries = new Map<number, AlignedSignature>();
    for (const { key, rotation } of shortlist) {
      if (failed.has(key)) {
        continue;
      }
      const reference = (cached.has(key) ? cached.get(key) : fetched.get(key)) ?? null;
      remember(key, reference);
      if (!reference) {
        continue;
      }
      let query = queries.get(rotation);
      if (!query) {
        query = alignedSignature(card, rotation);
        queries.set(rotation, query);
      }
      scores.push({ key, score: alignedScore(query, reference) });
    }
    return { scores, failed: [...failed] };
  };
}
