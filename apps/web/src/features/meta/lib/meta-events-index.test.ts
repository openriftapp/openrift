import type { MetaEventFacetsResponse } from "@openrift/shared/types/api/meta";
import { describe, expect, it } from "vitest";

import {
  facetCountsFrom,
  facetPresenceFrom,
  holdingsCountsFrom,
  metaEventCountries,
  nextEventSort,
} from "@/features/meta/lib/meta-events-index";

function facets(overrides: Partial<MetaEventFacetsResponse> = {}): MetaEventFacetsResponse {
  return {
    formats: [{ value: "constructed", count: 12 }],
    tiers: [
      { value: "local", count: 9 },
      { value: "premier", count: 3 },
    ],
    countries: [
      { value: "DE", count: 7 },
      { value: "FR", count: 2 },
    ],
    holdings: { all: 12, decks: 4, standings: 8, upcoming: 2, resultless: 2 },
    totals: { events: 12, playerRows: 384, decks: 40 },
    ...overrides,
  };
}

describe("facetCountsFrom", () => {
  it("keys each facet's count by the value the chip shows", () => {
    const counts = facetCountsFrom(facets());

    expect(counts.tiers.get("premier")).toBe(3);
    expect(counts.formats.get("draft")).toBeUndefined();
  });

  it("keys a country by its normalized code, which is what the chip looks up", () => {
    const counts = facetCountsFrom(facets());

    expect(counts.countries.get("de")).toBe(7);
    expect(counts.countries.get("DE")).toBeUndefined();
  });

  it("drops a country code no country answers to", () => {
    const counts = facetCountsFrom(facets({ countries: [{ value: "???", count: 4 }] }));

    expect([...counts.countries]).toEqual([]);
  });
});

describe("facetPresenceFrom", () => {
  it("offers a chip only the values the filtered events carry", () => {
    const present = facetPresenceFrom(facets());

    expect([...present.tiers]).toEqual(["local", "premier"]);
    expect(present.countries.has("US")).toBe(false);
  });

  it("carries a country under its normalized code, which is what the chip looks up", () => {
    const present = facetPresenceFrom(facets());

    expect(present.countries.has("fr")).toBe(true);
    expect(present.countries.has("FR")).toBe(false);
  });
});

describe("holdingsCountsFrom", () => {
  it("counts every choice, the unnarrowed one under the empty key", () => {
    const counts = holdingsCountsFrom(facets());

    expect(counts.get("")).toBe(12);
    expect(counts.get("decks")).toBe(4);
    expect(counts.get("standings")).toBe(8);
    expect(counts.get("upcoming")).toBe(2);
  });
});

describe("metaEventCountries", () => {
  it("offers each country the filtered events name, alphabetically", () => {
    expect(metaEventCountries(["DE", "FR"], {})).toEqual(["DE", "FR"]);
  });

  it("still offers a country the scope picked, so the reader can pick it back off", () => {
    expect(metaEventCountries([], { countries: ["it"] })).toEqual(["IT"]);
    expect(metaEventCountries([], { countriesEx: ["AT"] })).toEqual(["AT"]);
  });

  it("drops a code no country answers to", () => {
    expect(metaEventCountries(["??"], {})).toEqual([]);
  });
});

describe("nextEventSort", () => {
  it("flips the direction on the active column", () => {
    expect(nextEventSort({ sort: "date", direction: "desc" }, "date")).toEqual({
      sort: "date",
      direction: "asc",
    });
  });

  it("starts a new column at its most interesting order", () => {
    const from = { sort: "name", direction: "asc" } as const;

    expect(nextEventSort(from, "players")).toEqual({ sort: "players", direction: "desc" });
    expect(nextEventSort(from, "decks")).toEqual({ sort: "decks", direction: "desc" });
    expect(nextEventSort(from, "country")).toEqual({ sort: "country", direction: "asc" });
  });
});
