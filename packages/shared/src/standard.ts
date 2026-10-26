import type { Printing, PrintingImage } from "./types/catalog.js";
import { LOW_RARITIES, WellKnown } from "./well-known.js";

type StandardCheckFields = Pick<
  Printing,
  | "artVariant"
  | "isSigned"
  | "isOvernumbered"
  | "markers"
  | "finish"
  | "rarity"
  | "size"
  | "hasFoilTwin"
>;

type FallbackCandidateFields = StandardCheckFields &
  Pick<
    Printing,
    | "printingId"
    | "cardId"
    | "language"
    | "canonicalRank"
    | "images"
    | "fallbackArtMode"
    | "fallbackImageId"
  >;

export type FallbackArtTag =
  | { kind: "substitute" }
  | { kind: "language"; language: string }
  | { kind: "marker"; slug: string; label: string }
  | { kind: "artVariant"; slug: string }
  | { kind: "overnumbered" }
  | { kind: "signed" }
  | { kind: "finish"; slug: string };

type FallbackTagFields = Pick<
  Printing,
  "language" | "markers" | "artVariant" | "isOvernumbered" | "isSigned" | "finish"
>;

/** What the shown artwork has that this printing's own would not. A pinned substitute has no printing behind it, so `artPrinting` is null. */
export function fallbackArtDifferences(
  printing: FallbackTagFields,
  artPrinting: Pick<Printing, "language"> | null,
): FallbackArtTag[] {
  const tags: FallbackArtTag[] = [];
  if (artPrinting === null) {
    tags.push({ kind: "substitute" });
  } else if (printing.language !== artPrinting.language) {
    tags.push({ kind: "language", language: artPrinting.language });
  }
  for (const marker of printing.markers) {
    tags.push({ kind: "marker", slug: marker.slug, label: marker.label });
  }
  const artVariant = printing.artVariant || WellKnown.artVariant.NORMAL;
  if (artVariant !== WellKnown.artVariant.NORMAL) {
    tags.push({ kind: "artVariant", slug: artVariant });
  }
  if (printing.isOvernumbered) {
    tags.push({ kind: "overnumbered" });
  }
  if (printing.isSigned) {
    tags.push({ kind: "signed" });
  }
  if (
    printing.finish === WellKnown.finish.METAL ||
    printing.finish === WellKnown.finish.METAL_DELUXE
  ) {
    tags.push({ kind: "finish", slug: printing.finish });
  }
  return tags;
}

/**
 * The plain collectible version of a card, excluding every premium,
 * promotional, or collector treatment. Always-foil rarities count foil as
 * standard, but their normal finish only when no foil twin exists.
 */
export function isStandardPrinting(printing: StandardCheckFields): boolean {
  if ((printing.artVariant || WellKnown.artVariant.NORMAL) !== WellKnown.artVariant.NORMAL) {
    return false;
  }
  if (printing.isOvernumbered) {
    return false;
  }
  if (printing.isSigned) {
    return false;
  }
  if (printing.markers.length > 0) {
    return false;
  }
  if (printing.rarity === WellKnown.rarity.SHOWCASE) {
    return false;
  }
  if (printing.size !== WellKnown.cardSize.STANDARD) {
    return false;
  }
  const { finish, rarity } = printing;
  if (finish === WellKnown.finish.METAL || finish === WellKnown.finish.METAL_DELUXE) {
    return false;
  }
  if (LOW_RARITIES.has(rarity)) {
    return finish === WellKnown.finish.NORMAL;
  }
  if (finish === WellKnown.finish.FOIL) {
    return true;
  }
  return finish === WellKnown.finish.NORMAL && printing.hasFoilTwin !== true;
}

type FoilTwinFields = Pick<
  Printing,
  | "printingId"
  | "cardId"
  | "shortCode"
  | "language"
  | "artVariant"
  | "isSigned"
  | "isOvernumbered"
  | "markers"
  | "finish"
  | "size"
>;

/**
 * Mirrors `mv_printing_foil_twins`: a printing with no foil side has a twin when a
 * same-size printing with a foil side matches it side for side, finish aside.
 */
export function withFoilTwins<T extends FoilTwinFields>(
  sides: readonly T[],
): (T & { hasFoilTwin?: true })[] {
  const groups = [...Map.groupBy(sides, (side) => side.printingId).values()];
  const identity = (group: readonly T[]) =>
    JSON.stringify([
      group[0]?.size,
      ...group.map((side) => [
        side.cardId,
        side.shortCode,
        side.language,
        side.artVariant,
        side.isSigned,
        side.isOvernumbered,
        side.markers.map((marker) => marker.slug),
      ]),
    ]);
  const hasFoilSide = (group: readonly T[]) =>
    group.some((side) => side.finish === WellKnown.finish.FOIL);

  const foilIdentities = new Set(
    groups.filter((group) => hasFoilSide(group)).map((group) => identity(group)),
  );
  const twinned = new Set(
    groups
      .filter((group) => !hasFoilSide(group) && foilIdentities.has(identity(group)))
      .map((group) => group[0]?.printingId),
  );
  return sides.map((side) =>
    twinned.has(side.printingId) ? { ...side, hasFoilTwin: true as const } : side,
  );
}

export interface StandardArtFallback<T = Printing> {
  printing: T | null;
  image: PrintingImage;
}

// `candidates` must already be scoped to one card. A pin whose image belongs
// to another card resolves to a null printing, not an error.
function resolvePinnedArt<T extends FallbackCandidateFields>(
  imageId: string,
  printing: T,
  candidates: readonly T[],
): StandardArtFallback<T> {
  const source = candidates.find(
    (c) => c.printingId !== printing.printingId && c.images.some((img) => img.imageId === imageId),
  );
  return { printing: source ?? null, image: { imageId } };
}

// An admin override takes precedence over the derived search: "none"
// suppresses the substitute entirely, "pinned" shows the pinned file. A
// "pinned" printing with no servable image yet falls through to deriving.
export function findStandardArtFallback<T extends FallbackCandidateFields>(
  printing: T,
  candidates: readonly T[],
): StandardArtFallback<T> | null {
  if (printing.fallbackArtMode === "none") {
    return null;
  }
  if (printing.fallbackArtMode === "pinned" && printing.fallbackImageId !== undefined) {
    return resolvePinnedArt(printing.fallbackImageId, printing, candidates);
  }
  const ranked = candidates
    .filter(
      (c) =>
        c.printingId !== printing.printingId &&
        c.cardId === printing.cardId &&
        isStandardPrinting(c),
    )
    .toSorted((a, b) => a.canonicalRank - b.canonicalRank);
  const languages =
    printing.language === WellKnown.language.EN
      ? [WellKnown.language.EN]
      : [printing.language, WellKnown.language.EN];
  for (const language of languages) {
    for (const candidate of ranked) {
      if (candidate.language !== language) {
        continue;
      }
      const image = candidate.images[0];
      if (image) {
        return { printing: candidate, image };
      }
    }
  }
  return null;
}
