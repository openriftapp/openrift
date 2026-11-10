import type { CardFilters } from "@openrift/shared/types/search";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";
import { describe, expect, it } from "vitest";

import { FILTER_DIMENSIONS } from "@/features/cards/lib/filter-dimensions";
import { scopeFromFilters, statsScopePredicate } from "@/features/collections/lib/stats-scope";
import { stubPrinting } from "@/test/factories";

import { HIDDEN_FILTER_SECTIONS } from "./use-stats-scope";

const ACTIVE_SAMPLES: Record<string, Partial<CardFilters>> = {
  languages: { languages: ["EN"] },
  sets: { sets: ["OGN"] },
  domains: { domains: ["fury"] },
  rarities: { rarities: ["rare"] },
  types: { types: ["unit"] },
  artVariants: { artVariants: ["showcase"] },
  finishes: { finishes: ["foil"] },
  overnumbered: { isOvernumbered: true },
  signed: { isSigned: true },
  standard: { isStandard: true },
  cardSizes: { cardSizes: ["oversized"] },
  customTags: { customTagSlugs: ["favorites"] },
  tags: { tags: ["Poro"] },
  keywords: { keywords: ["Accelerate"] },
  banned: { isBanned: true },
  errata: { hasErrata: true },
};

const visibleDimensions = FILTER_DIMENSIONS.filter(
  (dimension) => !HIDDEN_FILTER_SECTIONS.has(dimension.section),
);

describe("scopeFromFilters", () => {
  it("returns an empty scope for empty filters", () => {
    expect(scopeFromFilters(EMPTY_CARD_FILTERS)).toEqual({});
  });

  it.each(visibleDimensions.map((dimension) => dimension.key))(
    "narrows the scope when the visible %s filter is set",
    (key) => {
      const sample = ACTIVE_SAMPLES[key];
      expect(sample, `no active sample for visible filter dimension "${key}"`).toBeDefined();
      expect(scopeFromFilters({ ...EMPTY_CARD_FILTERS, ...sample })).not.toEqual({});
    },
  );

  it("keeps overnumbered printings in or out of the stats scope", () => {
    const overnumbered = stubPrinting({ isOvernumbered: true });
    const regular = stubPrinting({ isOvernumbered: false });
    const only = scopeFromFilters({ ...EMPTY_CARD_FILTERS, isOvernumbered: true });
    const without = scopeFromFilters({ ...EMPTY_CARD_FILTERS, isOvernumbered: false });

    expect(statsScopePredicate(only)(overnumbered)).toBe(true);
    expect(statsScopePredicate(only)(regular)).toBe(false);
    expect(statsScopePredicate(without)(overnumbered)).toBe(false);
    expect(statsScopePredicate(without)(regular)).toBe(true);
  });
});
