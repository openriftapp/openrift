import { WellKnown } from "../well-known.js";
import type {
  BoosterBasis,
  BoosterDefinition,
  BoosterLanguage,
  BoosterOutcome,
  BoosterPredicate,
  BoosterPrinting,
  BoosterSlot,
} from "./types.js";

const { rarity, finish, artVariant } = WellKnown;

function hasRuneFace(p: BoosterPrinting): boolean {
  return p.types.includes(WellKnown.cardType.RUNE);
}

function hasTokenFace(p: BoosterPrinting): boolean {
  return p.superTypes.includes(WellKnown.superType.TOKEN);
}

function isCardFace(p: BoosterPrinting): boolean {
  return !hasRuneFace(p) && !hasTokenFace(p);
}

function isPlainNormal(p: BoosterPrinting, finishSlug: string): boolean {
  return (
    p.finish === finishSlug &&
    p.artVariant === artVariant.NORMAL &&
    !p.isOvernumbered &&
    !p.isSigned
  );
}

function ofRarity(...slugs: string[]): BoosterPredicate {
  return (p) => slugs.includes(p.rarity);
}

const isCommon: BoosterPredicate = (p) =>
  ofRarity(rarity.COMMON)(p) && isPlainNormal(p, finish.NORMAL) && isCardFace(p);

const isUncommon: BoosterPredicate = (p) =>
  ofRarity(rarity.UNCOMMON)(p) && isPlainNormal(p, finish.NORMAL) && isCardFace(p);

const isFoilCommonOrUncommon: BoosterPredicate = (p) =>
  ofRarity(rarity.COMMON, rarity.UNCOMMON)(p) && isPlainNormal(p, finish.FOIL) && isCardFace(p);

const isRare: BoosterPredicate = (p) =>
  ofRarity(rarity.RARE)(p) && isPlainNormal(p, finish.FOIL) && isCardFace(p);

const isEpic: BoosterPredicate = (p) =>
  ofRarity(rarity.EPIC)(p) && isPlainNormal(p, finish.FOIL) && isCardFace(p);

const isUltimate: BoosterPredicate = (p) => p.artVariant === artVariant.ULTIMATE;

const isSignedOvernumbered: BoosterPredicate = (p) =>
  p.isOvernumbered && p.isSigned && !isUltimate(p);

const isOvernumbered: BoosterPredicate = (p) => p.isOvernumbered && !p.isSigned && !isUltimate(p);

const isAltArt: BoosterPredicate = (p) =>
  p.artVariant === artVariant.ALTART && !p.isOvernumbered && !p.isSigned && isCardFace(p);

/** Vendetta's and Radiance's "SP" printings: showcase rarity on normal art. */
const isSpecialAltArt: BoosterPredicate = (p) =>
  ofRarity(rarity.SHOWCASE)(p) &&
  p.artVariant === artVariant.NORMAL &&
  !p.isOvernumbered &&
  !p.isSigned &&
  isCardFace(p);

const isAltArtRune: BoosterPredicate = (p) =>
  hasRuneFace(p) && p.artVariant === artVariant.ALTART && !p.isOvernumbered && !p.isSigned;

const isToken: BoosterPredicate = (p) => hasTokenFace(p) && !hasRuneFace(p) && !p.isSigned;

const isRune: BoosterPredicate = (p) => hasRuneFace(p) && isPlainNormal(p, finish.NORMAL);

function carried(basis: BoosterBasis): BoosterBasis {
  return basis === "official" ? "estimate" : basis;
}

function commonSlots(rateBasis: (basis: BoosterBasis) => BoosterBasis): BoosterSlot[] {
  return [
    {
      slug: "common",
      count: 7,
      outcomes: [
        { slug: "common", matches: isCommon, fillsRest: true, basis: rateBasis("official") },
      ],
    },
    {
      slug: "uncommon",
      count: 3,
      outcomes: [
        { slug: "uncommon", matches: isUncommon, fillsRest: true, basis: rateBasis("official") },
      ],
    },
    {
      slug: "foil",
      count: 1,
      outcomes: [
        { slug: "foil-epic", matches: isEpic, perPack: 1 / 100, basis: "guess" },
        { slug: "foil-rare", matches: isRare, perPack: 1 / 25, basis: "guess" },
        {
          slug: "foil-common-uncommon",
          matches: isFoilCommonOrUncommon,
          fillsRest: true,
          basis: "guess",
        },
      ],
    },
  ];
}

const RUNE_SLOT: BoosterSlot = {
  slug: "rune",
  count: 1,
  outcomes: [
    { slug: "alt-art-rune", matches: isAltArtRune, perPack: 0.05, basis: "guess" },
    { slug: "token", matches: isToken, perPack: 0.7, basis: "guess" },
    { slug: "rune", matches: isRune, fillsRest: true, basis: "guess" },
  ],
};

function premiumOutcomes(
  rateBasis: (basis: BoosterBasis) => BoosterBasis,
  cards?: number,
): BoosterOutcome[] {
  return [
    {
      slug: "signed-overnumbered",
      matches: isSignedOvernumbered,
      perPack: 1 / 720,
      basis: rateBasis("official"),
      cards,
    },
    {
      slug: "overnumbered",
      matches: isOvernumbered,
      perPack: 1 / 80,
      basis: rateBasis("official"),
      cards,
    },
    { slug: "alt-art", matches: isAltArt, perPack: 1 / 12, basis: rateBasis("official"), cards },
  ];
}

function rareSlot(outcomes: BoosterOutcome[]): BoosterSlot {
  return {
    slug: "rare",
    count: 2,
    outcomes: [...outcomes, { slug: "rare", matches: isRare, fillsRest: true, basis: "official" }],
  };
}

function epic(basis: BoosterBasis): BoosterOutcome {
  return { slug: "epic", matches: isEpic, perPack: 0.25, basis };
}

function specialAltArt(basis: BoosterBasis, cards?: number): BoosterOutcome {
  return { slug: "special-alt-art", matches: isSpecialAltArt, perPack: 1 / 12, basis, cards };
}

function ultimate(perPack: number, bound?: "max", cards?: number): BoosterOutcome {
  return { slug: "ultimate", matches: isUltimate, perPack, bound, basis: "official", cards };
}

function languages(codes: readonly string[]): Record<string, BoosterLanguage> {
  const regional = new Set(["KR", "SC", "TC"]);
  const smallBox = new Set(["SC", "TC"]);
  return Object.fromEntries(
    codes.map((code) => [
      code,
      {
        packsPerBox: smallBox.has(code) ? 12 : 24,
        boxesPerCase: 6,
        ...(regional.has(code) ? { basisCap: "estimate" as const } : {}),
      },
    ]),
  );
}

const identity = (basis: BoosterBasis): BoosterBasis => basis;

export const BOOSTERS: Readonly<Record<string, BoosterDefinition>> = {
  "origins-booster-pack": {
    set: "OGN",
    layoutBasis: "official",
    languages: languages(["EN", "FR", "KR", "SC", "TC"]),
    slots: [
      ...commonSlots(identity),
      rareSlot([...premiumOutcomes(identity), epic("official")]),
      RUNE_SLOT,
    ],
    acknowledged: [
      { shortCode: "OGN-191", language: "FR" },
      { shortCode: "OGN-191", language: "KR" },
    ],
  },
  "spiritforged-booster-pack": {
    set: "SFD",
    layoutBasis: "estimate",
    languages: languages(["EN", "FR", "KR", "SC", "TC"]),
    slots: [
      ...commonSlots(carried),
      rareSlot([...premiumOutcomes(carried), epic("estimate")]),
      RUNE_SLOT,
    ],
    acknowledged: [],
  },
  "unleashed-booster-pack": {
    set: "UNL",
    layoutBasis: "official",
    languages: languages(["EN", "FR", "KR", "SC"]),
    slots: [
      ...commonSlots(carried),
      rareSlot([ultimate(0.001, "max", 1), ...premiumOutcomes(carried), epic("estimate")]),
      RUNE_SLOT,
    ],
    acknowledged: [],
  },
  "vendetta-booster-pack": {
    set: "VEN",
    layoutBasis: "official",
    languages: languages(["EN", "FR", "KR", "SC"]),
    slots: [
      ...commonSlots(carried),
      rareSlot([...premiumOutcomes(carried), specialAltArt("estimate"), epic("estimate")]),
      RUNE_SLOT,
    ],
    acknowledged: [],
  },
  "radiance-booster-pack": {
    set: "RAD",
    layoutBasis: "official",
    languages: languages(["EN", "SC"]),
    slots: [
      ...commonSlots(carried),
      rareSlot([
        ultimate(1 / 4000, undefined, 1),
        ...premiumOutcomes(carried, 1),
        specialAltArt("estimate", 1),
        epic("estimate"),
      ]),
      RUNE_SLOT,
    ],
    acknowledged: [
      { shortCode: "RAD-174a", language: "EN" },
      { shortCode: "RAD-174a*", language: "EN" },
    ],
  },
};

export function cardsPerPack(booster: BoosterDefinition): number {
  return booster.slots.reduce((sum, slot) => sum + slot.count, 0);
}

export function boosterSlugForSet(setSlug: string): string | undefined {
  return Object.entries(BOOSTERS).find(([, booster]) => booster.set === setSlug)?.[0];
}
