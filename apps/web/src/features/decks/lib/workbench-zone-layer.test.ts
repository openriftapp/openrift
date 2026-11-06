import { describe, expect, it } from "vitest";

import type { DeckZoneFilterPreset } from "./deck-zone-filters";
import { applyZoneLayer, NO_MATCH, zoneLayerChips } from "./workbench-zone-layer";

function preset(overrides: {
  arrayFilters?: Partial<DeckZoneFilterPreset["arrayFilters"]>;
  clearStatRanges?: boolean;
  search?: string;
}): DeckZoneFilterPreset {
  return {
    arrayFilters: {
      types: [],
      superTypes: [],
      superTypesEx: [],
      domains: [],
      customTags: [],
      ...overrides.arrayFilters,
    },
    clearStatRanges: overrides.clearStatRanges ?? false,
    search: overrides.search ?? "",
  };
}

interface Range {
  min: number | null;
  max: number | null;
}

function filters(
  overrides: Partial<{
    search: string;
    types: string[];
    superTypes: string[];
    superTypesExclude: string[];
    domains: string[];
    customTagSlugs: string[];
    energy: Range;
    might: Range;
    power: Range;
  }> = {},
) {
  return {
    search: "",
    types: [] as string[],
    superTypes: [] as string[],
    superTypesExclude: [] as string[],
    domains: [] as string[],
    customTagSlugs: [] as string[],
    energy: { min: null, max: null } as Range,
    might: { min: null, max: null } as Range,
    power: { min: null, max: null } as Range,
    ...overrides,
  };
}

describe("zoneLayerChips", () => {
  it("returns no chips for an empty preset", () => {
    expect(zoneLayerChips(preset({}))).toEqual([]);
  });

  it("orders chips as includes, exclusions, search, then stats", () => {
    const chips = zoneLayerChips(
      preset({
        arrayFilters: {
          superTypesEx: ["token"],
          customTags: ["tag-a"],
          domains: ["fury"],
          superTypes: ["champion"],
          types: ["unit"],
        },
        clearStatRanges: true,
        search: "tag:x",
      }),
    );
    expect(chips.map((chip) => chip.key)).toEqual([
      "types:unit",
      "superTypes:champion",
      "domains:fury",
      "customTags:tag-a",
      "superTypesEx:token",
      "search:tag:x",
      "stats",
    ]);
  });

  it("emits one chip per value with kind and value", () => {
    expect(zoneLayerChips(preset({ arrayFilters: { domains: ["fury", "calm"] } }))).toEqual([
      { key: "domains:fury", kind: "domains", value: "fury" },
      { key: "domains:calm", kind: "domains", value: "calm" },
    ]);
  });

  it("emits a stats chip with an empty value", () => {
    expect(zoneLayerChips(preset({ clearStatRanges: true }))).toEqual([
      { key: "stats", kind: "stats", value: "" },
    ]);
  });
});

describe("applyZoneLayer", () => {
  it("returns equal filters for an empty preset", () => {
    const input = filters({ types: ["unit"], search: "abc" });
    expect(applyZoneLayer(input, preset({}))).toEqual(input);
  });

  it("does not mutate the input filters", () => {
    const input = filters({ types: ["unit"] });
    const result = applyZoneLayer(input, preset({ arrayFilters: { types: ["rune"] } }));
    expect(result).not.toBe(input);
    expect(input.types).toEqual(["unit"]);
  });

  it("uses the zone values when the user has none", () => {
    const result = applyZoneLayer(
      filters(),
      preset({ arrayFilters: { types: ["unit"], domains: ["fury", "neutral"] } }),
    );
    expect(result.types).toEqual(["unit"]);
    expect(result.domains).toEqual(["fury", "neutral"]);
  });

  it("intersects the user's values with the zone values", () => {
    const result = applyZoneLayer(
      filters({ domains: ["fury", "mind"] }),
      preset({ arrayFilters: { domains: ["fury", "calm"] } }),
    );
    expect(result.domains).toEqual(["fury"]);
  });

  it("maps customTags onto customTagSlugs", () => {
    const result = applyZoneLayer(filters(), preset({ arrayFilters: { customTags: ["tag-a"] } }));
    expect(result.customTagSlugs).toEqual(["tag-a"]);
  });

  it("adds zone exclusions to the user's exclusions without duplicates", () => {
    const result = applyZoneLayer(
      filters({ superTypesExclude: ["basic", "token"] }),
      preset({ arrayFilters: { superTypesEx: ["token", "signature"] } }),
    );
    expect(result.superTypesExclude).toEqual(["basic", "token", "signature"]);
  });

  it("joins the zone search after the user's search", () => {
    const result = applyZoneLayer(filters({ search: "jinx" }), preset({ search: "tag:a" }));
    expect(result.search).toBe("jinx tag:a");
  });

  it("uses the zone search alone when the user search is empty", () => {
    const result = applyZoneLayer(filters(), preset({ search: "tag:a" }));
    expect(result.search).toBe("tag:a");
  });

  it("clears stat ranges when the preset asks for it", () => {
    const range = { min: 1, max: 5 };
    const result = applyZoneLayer(
      filters({ energy: range, might: range, power: range }),
      preset({ clearStatRanges: true }),
    );
    expect(result.energy).toEqual({ min: null, max: null });
    expect(result.might).toEqual({ min: null, max: null });
    expect(result.power).toEqual({ min: null, max: null });
  });

  it("matches nothing when the user's values do not overlap the zone's", () => {
    const result = applyZoneLayer(
      filters({ domains: ["mind"] }),
      preset({ arrayFilters: { domains: ["fury"] } }),
    );
    expect(result.domains).toEqual([NO_MATCH]);
  });
});
