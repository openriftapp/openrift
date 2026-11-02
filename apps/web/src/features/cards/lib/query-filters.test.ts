import { NONE } from "@openrift/shared/types/search";
import { describe, expect, it } from "vitest";

import type { QueryFilterOptions } from "@/features/cards/lib/query-filters";
import { absorbQueryFilters, showQueryFilters } from "@/features/cards/lib/query-filters";
import type { FilterSearch } from "@/features/cards/lib/search-schemas";

const options: QueryFilterOptions = {
  vocabulary: {
    domain: ["fury", "calm", "chaos"],
    rarity: ["common", "rare", "epic"],
    set: [{ value: "OGN", names: ["Origins"] }],
    lang: ["EN", "DE"],
    marker: ["promo-stamp"],
  },
  visible: new Set([
    "sets",
    "languages",
    "rarities",
    "types",
    "superTypes",
    "domains",
    "artVariants",
    "finishes",
    "cardSizes",
    "markers",
    "keywords",
    "tags",
    "signed",
    "standard",
    "errata",
    "noImage",
    "energy",
    "might",
    "price",
  ]),
  values: {
    sets: ["OGN"],
    languages: ["EN", "DE"],
    rarities: ["common", "rare", "epic"],
    types: ["unit", "spell"],
    superTypes: ["champion"],
    domains: ["fury", "calm", "chaos"],
    finishes: ["normal", "foil"],
    artVariants: ["normal", "altart"],
    cardSizes: ["standard", "oversized"],
    markers: ["promo-stamp"],
    keywords: ["Shield"],
    tags: ["Yordle"],
  },
  nullableRanges: new Set(["energy"]),
};

function show(q: string, params: FilterSearch = {}) {
  return showQueryFilters({ ...params, q }, options);
}

describe("showQueryFilters", () => {
  it("lights the button for a single-value clause and reports its span", () => {
    const view = show("d:fury jinx");
    expect(view.search.domains).toEqual(["fury"]);
    expect(view.search.q).toBe("d:fury jinx");
    expect(view.spans).toEqual([{ start: 0, end: 6 }]);
  });

  it("resolves values through the vocabulary and maps them to the button's casing", () => {
    expect(show("d:fu").search.domains).toEqual(["fury"]);
    expect(show("s:origins").search.sets).toEqual(["OGN"]);
    expect(show("lang:de").search.languages).toEqual(["DE"]);
  });

  it("maps negations and != to the exclude state", () => {
    expect(show("-d:fury").search.domainsEx).toEqual(["fury"]);
    expect(show("r!=rare -r:epic").search.raritiesEx).toEqual(["rare", "epic"]);
    expect(show("-r!=rare").search.rarities).toEqual(["rare"]);
  });

  it("leaves domain clauses with other meanings in the query", () => {
    for (const query of ["d=fury", "d!=fury", "d:fury,calm", "d:fury d:calm", "d<=fury"]) {
      const view = show(query);
      expect(view.spans, query).toEqual([]);
      expect(view.search.domains, query).toBeUndefined();
    }
  });

  it("skips clauses inside OR groups and nested brackets", () => {
    expect(show("d:fury or d:calm").spans).toEqual([]);
    expect(show("(d:fury or r:rare) s:ogn").search.sets).toEqual(["OGN"]);
  });

  it("maps type, keyword and tag text clauses only when they name a known value", () => {
    expect(show("t:unit").search.types).toEqual(["unit"]);
    expect(show("t:champion").search.superTypes).toEqual(["champion"]);
    expect(show("-t:spell").search.typesEx).toEqual(["spell"]);
    expect(show("kw:shield").search.keywords).toEqual(["Shield"]);
    expect(show("tag:yordle").search.tags).toEqual(["Yordle"]);
    expect(show("t:uni").spans).toEqual([]);
  });

  it("maps is: and has: flags onto finishes, variants and toggles", () => {
    expect(show("is:foil").search.finishes).toEqual(["foil"]);
    expect(show("not:foil").search.finishesEx).toEqual(["foil"]);
    expect(show("is:altart").search.artVariants).toEqual(["altart"]);
    expect(show("is:oversized").search.cardSizes).toEqual(["oversized"]);
    expect(show("-is:oversized").spans).toEqual([]);
    expect(show("is:signed").search.signed).toBe(true);
    expect(show("-is:signed").search.signed).toBe(false);
    expect(show("is:plain").search.standard).toBe(true);
    expect(show("is:variant").search.standard).toBe(false);
    expect(show("has:errata").search.errata).toBe(true);
    expect(show("-has:image").search.noImage).toBe(true);
    expect(show("is:promo").search.markersPresence).toBe("any");
    expect(show("-has:keyword").search.keywordsPresence).toBe("none");
  });

  it("skips clauses whose dimension the surface does not show", () => {
    expect(show("is:overnumbered").spans).toEqual([]);
    expect(show("p>=3").spans).toEqual([]);
  });

  it("turns comparisons into range bounds", () => {
    expect(show("m>=3").search).toMatchObject({ mightMin: 3, mightMax: undefined });
    expect(show("m>3 m<6").search).toMatchObject({ mightMin: 4, mightMax: 5 });
    expect(show("m:2").search).toMatchObject({ mightMin: 2, mightMax: 2 });
    expect(show("price<=5.5").search).toMatchObject({ priceMax: 5.5 });
    expect(show("price>5").spans).toEqual([]);
    expect(show("m!=2").spans).toEqual([]);
    expect(show("-m>=2").spans).toEqual([]);
  });

  it("opts null energy in when the query's bound covers 0", () => {
    expect(show("e>=2").search).toMatchObject({ energyMin: 2, energyMax: undefined });
    expect(show("e<=3").search).toMatchObject({ energyMin: NONE, energyMax: 3 });
    expect(show("e:0").search).toMatchObject({ energyMin: NONE, energyMax: 0 });
    expect(show("e<0").spans).toEqual([]);
  });

  it("keeps plain bounds when the surface has no null-energy cards", () => {
    const view = showQueryFilters({ q: "e<=3" }, { ...options, nullableRanges: new Set() });
    expect(view.search).toMatchObject({ energyMin: undefined, energyMax: 3 });
  });

  it("maps a clause that repeats a button param and skips one that would change it", () => {
    expect(show("d:fury", { domains: ["fury"] }).spans).toHaveLength(1);
    expect(show("d:fury", { domains: ["calm"] }).spans).toEqual([]);
    expect(show("-d:fury", { domains: ["calm"] }).search).toMatchObject({
      domains: ["calm"],
      domainsEx: ["fury"],
    });
    expect(show("d:fury", { domainsEx: ["fury"] }).spans).toEqual([]);
    expect(show("lang:de", { languages: ["EN"] }).spans).toEqual([]);
    expect(show("is:signed", { signed: false }).spans).toEqual([]);
    expect(show("m>=3", { mightMin: 2 }).spans).toEqual([]);
    expect(show("is:promo", { markers: ["promo-stamp"] }).spans).toEqual([]);
  });

  it("returns the search untouched without options or a query", () => {
    const raw: FilterSearch = { q: "d:fury" };
    expect(showQueryFilters(raw, null)).toEqual({ search: raw, spans: [] });
    expect(showQueryFilters({}, options).spans).toEqual([]);
  });
});

function absorb(raw: FilterSearch, keys: readonly string[]): FilterSearch {
  return absorbQueryFilters(raw, keys, options);
}

describe("absorbQueryFilters", () => {
  it("moves the touched dimension's clauses out of the query", () => {
    const next = absorb({ q: "jinx d:fury r:rare" }, ["domains"]);
    expect(next).toMatchObject({ q: "jinx r:rare", domains: ["fury"] });
    expect(next.rarities).toBeUndefined();
  });

  it("absorbs the include side when the exclude param is touched", () => {
    expect(absorb({ q: "d:fury -d:calm" }, ["domainsEx"])).toMatchObject({
      q: undefined,
      domains: ["fury"],
      domainsEx: ["calm"],
    });
  });

  it("absorbs range bounds and flags by their params", () => {
    expect(absorb({ q: "e>=2 is:signed" }, ["energyMax"])).toMatchObject({
      q: "is:signed",
      energyMin: 2,
    });
    expect(absorb({ q: "e>=2 is:signed" }, ["signed"])).toMatchObject({
      q: "e>=2",
      signed: true,
    });
  });

  it("leaves the search alone for params outside any mapped dimension", () => {
    const raw: FilterSearch = { q: "d:fury" };
    expect(absorb(raw, ["q", "sort"])).toBe(raw);
    expect(absorb(raw, ["rarities"])).toBe(raw);
  });

  it("keeps unmapped clauses of the same dimension in the query", () => {
    expect(absorb({ q: "d:fury,calm" }, ["domains"])).toEqual({
      q: "d:fury,calm",
    });
  });
});
