import { describe, expect, it } from "vitest";

import {
  ALL_SEARCH_FIELDS,
  cardFiltersSchema,
  DEFAULT_SEARCH_SCOPE,
  EMPTY_CARD_FILTERS,
  SEARCH_PREFIX_MAP,
} from "./search";

describe("cardFiltersSchema defaults", () => {
  it("parses an empty object into the blank filter set, catching any dimension missing a default", () => {
    expect(cardFiltersSchema.parse({})).toEqual(EMPTY_CARD_FILTERS);
  });

  it("backfills dimensions absent from a persisted filter to 'no constraint'", () => {
    const stale = { ...EMPTY_CARD_FILTERS } as Record<string, unknown>;
    delete stale.presence;
    delete stale.keywords;
    delete stale.keywordsExclude;

    const parsed = cardFiltersSchema.parse(stale);
    expect(parsed.presence).toEqual({});
    expect(parsed.keywords).toEqual([]);
    expect(parsed.keywordsExclude).toEqual([]);
  });

  it("drops a superseded key like the old hasAnyMarker boolean", () => {
    const withSuperseded = { ...EMPTY_CARD_FILTERS, hasAnyMarker: true };
    expect("hasAnyMarker" in cardFiltersSchema.parse(withSuperseded)).toBe(false);
  });

  it("preserves explicitly-set dimensions", () => {
    const parsed = cardFiltersSchema.parse({
      ...EMPTY_CARD_FILTERS,
      rarities: ["rare"],
      keywords: ["Shield"],
      isBanned: true,
    });
    expect(parsed.rarities).toEqual(["rare"]);
    expect(parsed.keywords).toEqual(["Shield"]);
    expect(parsed.isBanned).toBe(true);
  });
});

describe("constants", () => {
  it("ALL_SEARCH_FIELDS includes all 8 fields", () => {
    expect(ALL_SEARCH_FIELDS).toHaveLength(8);
    expect(ALL_SEARCH_FIELDS).toContain("name");
    expect(ALL_SEARCH_FIELDS).toContain("flavorText");
    expect(ALL_SEARCH_FIELDS).toContain("type");
    expect(ALL_SEARCH_FIELDS).toContain("id");
  });

  it("DEFAULT_SEARCH_SCOPE includes all fields", () => {
    expect(DEFAULT_SEARCH_SCOPE).toEqual(ALL_SEARCH_FIELDS);
  });

  it("SEARCH_PREFIX_MAP maps prefixes to fields", () => {
    expect(SEARCH_PREFIX_MAP.n).toBe("name");
    expect(SEARCH_PREFIX_MAP.d).toBe("cardText");
    expect(SEARCH_PREFIX_MAP.k).toBe("keywords");
    expect(SEARCH_PREFIX_MAP.t).toBe("tags");
    expect(SEARCH_PREFIX_MAP.a).toBe("artist");
    expect(SEARCH_PREFIX_MAP.f).toBe("flavorText");
    expect(SEARCH_PREFIX_MAP.ty).toBe("type");
    expect(SEARCH_PREFIX_MAP.id).toBe("id");
  });
});
