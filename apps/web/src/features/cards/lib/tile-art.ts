import type { StandardArtFallback } from "@openrift/shared/standard";
import { findStandardArtFallback } from "@openrift/shared/standard";
import type { Printing } from "@openrift/shared/types/catalog";

import { frontImageId } from "@/features/cards/lib/card-meta";

type PrintingsByCardId = ReadonlyMap<string, readonly Printing[]>;

// Keyed by the candidates array, which is stable per catalog fetch.
const fallbackCache = new WeakMap<readonly Printing[], Map<string, StandardArtFallback | null>>();

export function standardArtFallback(
  printing: Printing,
  printingsByCardId: PrintingsByCardId | undefined,
): StandardArtFallback | null {
  const candidates = printingsByCardId?.get(printing.cardId);
  if (!candidates) {
    return null;
  }
  let byPrinting = fallbackCache.get(candidates);
  if (!byPrinting) {
    byPrinting = new Map();
    fallbackCache.set(candidates, byPrinting);
  }
  const cached = byPrinting.get(printing.printingId);
  if (cached !== undefined) {
    return cached;
  }
  const result = findStandardArtFallback(printing, candidates);
  byPrinting.set(printing.printingId, result);
  return result;
}

interface TileArt {
  imageId: string | null;
  fallback: StandardArtFallback | null;
}

export const NO_TILE_ART: TileArt = { imageId: null, fallback: null };

/** A grid tile shows the printing's own image, else (or when it fails to load) the borrowed art. */
export function tileArt(
  printing: Printing,
  fallbackFor: (printing: Printing) => StandardArtFallback | null,
): TileArt {
  return { imageId: frontImageId(printing), fallback: fallbackFor(printing) };
}

export function tileImageId(
  printing: Printing,
  printingsByCardId: PrintingsByCardId | undefined,
): string | null {
  const art = tileArt(printing, (shown) => standardArtFallback(shown, printingsByCardId));
  return art.imageId ?? art.fallback?.image.imageId ?? null;
}
