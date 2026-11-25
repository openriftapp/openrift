import type { CatalogSetResponse } from "@openrift/shared/types/api/catalog";
import type { Card, Printing } from "@openrift/shared/types/catalog";

const SET_COUNT = 7;
const CARD_COUNT = 771;
const PRINTING_COUNT = 2916;

const RARITIES = ["common", "uncommon", "rare", "legendary"] as const;
const DOMAINS = ["chaos", "order", "fury", "calm"] as const;
const TYPES = ["unit", "spell", "gear", "battlefield"] as const;
const LANGUAGES = ["EN", "DE", "FR", "ES"] as const;
const ART_VARIANTS = ["normal", "alternate", "borderless"] as const;
const FINISHES = ["normal", "foil"] as const;
const KEYWORDS_POOL = ["slam", "mighty", "swift", "fragile", "loyal", "deft"];
const NAME_SUFFIXES = ["Hero", "Rebel", "Ghost", "Knight", "Sage"];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49_297) % 233_280;
    return s / 233_280;
  };
}

function pick<T>(arr: readonly T[], r: () => number): T {
  const value = arr[Math.floor(r() * arr.length)];
  if (value === undefined) {
    throw new Error("pick() from empty array");
  }
  return value;
}

export function buildSyntheticPrintings(): Printing[] {
  const r = seededRandom(42);

  const sets: CatalogSetResponse[] = Array.from({ length: SET_COUNT }, (_, i) => ({
    id: `set-${i}`,
    slug: `SET${i + 1}`,
    name: `Test Set ${i + 1}`,
    releases: {},
    setType: i < 5 ? "main" : "supplemental",
  }));

  const cards: (Card & { id: string })[] = Array.from({ length: CARD_COUNT }, (_, i) => ({
    id: `card-${i}`,
    slug: `card-${i}`,
    name: `Card ${i} ${pick(NAME_SUFFIXES, r)}`,
    types: [pick(TYPES, r)],
    superTypes: r() > 0.8 ? ["champion"] : [],
    domains: [pick(DOMAINS, r), ...(r() > 0.7 ? [pick(DOMAINS, r)] : [])],
    tokenCardIds: [],
    might: Math.floor(r() * 10) - 1,
    energy: Math.floor(r() * 8) + 1,
    power: r() > 0.5 ? Math.floor(r() * 6) : null,
    keywords: r() > 0.5 ? [pick(KEYWORDS_POOL, r)] : [],
    tags: [],
    mightBonus: null,
    maxCopiesOverride: null,
    additionalLegendCount: null,
    errata: [],
    bans: [],
    numberedSetSlugs: [],
    upcomingBans: [],
  }));

  return Array.from({ length: PRINTING_COUNT }, (_, i): Printing => {
    const card = cards[i % CARD_COUNT];
    const set = sets[Math.floor(r() * SET_COUNT)];
    if (!card || !set) {
      throw new Error("fixture indexing out of range");
    }
    return {
      printingId: `printing-${i}`,
      side: 1,
      faceId: `printing-${i}`,
      cardId: card.id,
      shortCode: `${set.slug}-${String(i).padStart(3, "0")}`,
      setId: set.id,
      setSlug: set.slug,
      setReleased: true,
      rarity: pick(RARITIES, r),
      artVariant: pick(ART_VARIANTS, r),
      isSigned: r() > 0.9,
      isOvernumbered: false,
      markers: [],
      distributionChannels: [],
      finish: pick(FINISHES, r),
      size: "standard",
      images: [],
      artist: "Synthetic",
      publicCode: `synth-${i}`,
      printedRulesText: null,
      printedEffectText: null,
      flavorText: null,
      printedName: null,
      printedYear: null,
      comment: null,
      language: pick(LANGUAGES, r),
      canonicalRank: i + 1,
      card,
    };
  });
}
