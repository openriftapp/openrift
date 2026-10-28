import { describe, expect, it } from "vitest";

import type { FilterCardsOptions } from "../filters-shared.js";
import { emptyFilters, makePrinting } from "../filters-test-helpers.js";
import { filterCards } from "../filters.js";
import type { Printing } from "../types/catalog.js";
import { searchPredicate, sortByPreference } from "./evaluate.js";

const garen = makePrinting({
  printingId: "p-garen",
  cardId: "c-garen",
  shortCode: "OGN-001",
  setSlug: "OGN",
  rarity: "common",
  language: "EN",
  printedYear: 2025,
  setReleasedAt: "2025-10-31",
  printedRulesText: "Deal 3 to a unit.",
  card: {
    name: "Garen, Rugged",
    types: ["unit"],
    superTypes: ["champion"],
    domains: ["fury"],
    energy: 3,
    might: 4,
    power: 1,
    keywords: ["Shield"],
    tags: ["Demacia"],
  },
});

const annie = makePrinting({
  printingId: "p-annie",
  cardId: "c-annie",
  shortCode: "SFD-010",
  setSlug: "SFD",
  rarity: "epic",
  language: "FR",
  finish: "foil",
  artVariant: "altart",
  printedYear: 2026,
  setReleasedAt: "2026-02-13",
  printedRulesText: "Stun a unit.",
  card: {
    name: "Annie, Fiery",
    types: ["spell"],
    superTypes: [],
    domains: ["fury", "chaos"],
    energy: 5,
    might: null,
    power: 2,
    keywords: [],
    tags: [],
    bans: [
      { formatId: "standard", formatName: "Constructed", bannedAt: "2026-01-01", reason: null },
    ],
  },
});

const buff = makePrinting({
  printingId: "p-buff",
  cardId: "c-buff",
  shortCode: "OGN-300",
  setSlug: "OGN",
  rarity: "common",
  language: "EN",
  setReleasedAt: "2025-10-31",
  images: [],
  card: {
    name: "Buff",
    types: ["other"],
    superTypes: [],
    domains: ["colorless"],
    energy: null,
    might: null,
    power: null,
    keywords: [],
    tags: [],
  },
});

const token = makePrinting({
  printingId: "p-token",
  cardId: "c-token",
  shortCode: "OGN-301",
  setSlug: "OGN",
  rarity: "rare",
  language: "EN",
  setReleasedAt: "2025-10-31",
  card: {
    name: "Recruit",
    types: ["unit"],
    superTypes: ["token"],
    domains: ["order"],
    energy: 1,
    might: 1,
    power: null,
    keywords: [],
    tags: [],
  },
});

const all = [garen, annie, buff, token];

const PRICES: Record<string, { tcgplayer?: number; cardmarket?: number }> = {
  "p-garen": { tcgplayer: 0.5, cardmarket: 0.4 },
  "p-annie": { tcgplayer: 25, cardmarket: 18 },
};

const options: FilterCardsOptions = {
  priceLookup: {
    get: (printingId, marketplace) =>
      PRICES[printingId]?.[marketplace as "tcgplayer" | "cardmarket"],
    has: (printingId) => printingId in PRICES,
  },
  getPrice: (printing) => PRICES[printing.printingId]?.cardmarket,
  getOwnedCount: (printing) => (printing.printingId === "p-garen" ? 2 : 0),
  customTagAssignments: { "c-annie": ["burn"] },
};

function names(search: string, printings: Printing[] = all, opts: FilterCardsOptions = options) {
  return filterCards(printings, emptyFilters({ search }), opts).map(
    (printing) => printing.card.name,
  );
}

describe("search query evaluation", () => {
  it("matches bare words against card names only", () => {
    expect(names("garen")).toEqual(["Garen, Rugged"]);
    expect(names("stun")).toEqual([]);
    expect(names("o:stun")).toEqual(["Annie, Fiery"]);
  });

  it("treats a code-shaped bare word as a card number", () => {
    expect(names("ogn001")).toEqual(["Garen, Rugged"]);
    expect(names("OGN-001")).toEqual(["Garen, Rugged"]);
  });

  it("matches an exact name only in full", () => {
    expect(names('!"Garen, Rugged"')).toEqual(["Garen, Rugged"]);
    expect(names("!garen")).toEqual([]);
  });

  it("matches type against types and super types", () => {
    expect(names("t:spell")).toEqual(["Annie, Fiery"]);
    expect(names("t:champion")).toEqual(["Garen, Rugged"]);
  });

  it("matches card text with o:", () => {
    expect(names('o:"deal 3"')).toEqual(["Garen, Rugged"]);
  });

  it("supports exact and negated text operators", () => {
    expect(names("kw=shield")).toEqual(["Garen, Rugged"]);
    expect(names("kw=shi")).toEqual([]);
    expect(names("otag!=demacia")).toEqual(["Annie, Fiery", "Buff", "Recruit"]);
  });

  describe("domains", () => {
    it("includes multi-domain cards with d:", () => {
      expect(names("d:fury")).toEqual(["Garen, Rugged", "Annie, Fiery"]);
    });

    it("matches mono-domain cards with d=", () => {
      expect(names("d=fury")).toEqual(["Garen, Rugged"]);
    });

    it("requires every listed domain", () => {
      expect(names("d:fury d:chaos")).toEqual(["Annie, Fiery"]);
      expect(names("d>=fury,chaos")).toEqual(["Annie, Fiery"]);
    });

    it("keeps cards within a domain list with d<=, colorless included", () => {
      expect(names("d<=fury,chaos")).toEqual(["Garen, Rugged", "Annie, Fiery", "Buff"]);
      expect(names("d<fury,chaos")).toEqual(["Garen, Rugged", "Buff"]);
    });

    it("matches an exact domain list with d=", () => {
      expect(names("d=fury,chaos")).toEqual(["Annie, Fiery"]);
      expect(names("d>fury")).toEqual(["Annie, Fiery"]);
    });
  });

  describe("card numbers", () => {
    it("compares the numeric part of the code", () => {
      expect(names("cn>=300")).toEqual(["Buff", "Recruit"]);
      expect(names("cn<20")).toEqual(["Garen, Rugged", "Annie, Fiery"]);
    });
  });

  describe("print runs", () => {
    const reprint = makePrinting({
      printingId: "p-reprint",
      cardId: "c-garen",
      shortCode: "SFD-200",
      setSlug: "SFD",
      language: "FR",
      markers: [{ id: "m1", slug: "promo", label: "Promo", description: null }],
      cardSetSlugs: ["OGN", "SFD"],
      cardLanguages: ["EN", "FR"],
      isReprint: true,
      card: { name: "Garen, Rugged" },
    });
    const printings = [garen, reprint];

    it("matches cards printed in a set or language with in:", () => {
      expect(names("in:sfd", [reprint])).toEqual(["Garen, Rugged"]);
      expect(names("in:fr", [reprint])).toEqual(["Garen, Rugged"]);
      expect(names("in:fr", [annie])).toEqual(["Annie, Fiery"]);
      expect(names("in:ogn", [annie])).toEqual([]);
    });

    it("tells reprints from first printings", () => {
      expect(filterCards(printings, emptyFilters({ search: "is:reprint" }))).toEqual([reprint]);
      expect(filterCards(printings, emptyFilters({ search: "is:firstprint" }))).toEqual([garen]);
    });

    it("treats a printing with a marker as a promo", () => {
      expect(filterCards(printings, emptyFilters({ search: "is:promo" }))).toEqual([reprint]);
    });
  });

  describe("numbers", () => {
    it("compares stats", () => {
      expect(names("e<=3")).toEqual(["Garen, Rugged", "Recruit"]);
      expect(names("e:5")).toEqual(["Annie, Fiery"]);
      expect(names("m>=4")).toEqual(["Garen, Rugged"]);
      expect(names("p!=1")).toEqual(["Annie, Fiery"]);
    });

    it("never matches a missing stat, but its negation does", () => {
      expect(names("m>=0")).toEqual(["Garen, Rugged", "Recruit"]);
      expect(names("-m>=0")).toEqual(["Annie, Fiery", "Buff"]);
    });

    it("reads usd from TCGplayer and eur from Cardmarket", () => {
      expect(names("usd<1")).toEqual(["Garen, Rugged"]);
      expect(names("eur>=18")).toEqual(["Annie, Fiery"]);
    });

    it("reads price from the favorite marketplace", () => {
      expect(names("price<1")).toEqual(["Garen, Rugged"]);
    });

    it("matches no price key without a price lookup", () => {
      expect(names("usd<1000", all, {})).toEqual([]);
      expect(names("price<1000", all, {})).toEqual([]);
    });

    it("reads owned counts", () => {
      expect(names("owned>=1")).toEqual(["Garen, Rugged"]);
    });

    it("reads the printed year", () => {
      expect(names("year>=2026")).toEqual(["Annie, Fiery"]);
    });
  });

  describe("rarity", () => {
    it("matches by slug", () => {
      expect(names("r:epic")).toEqual(["Annie, Fiery"]);
    });

    it("compares along the rarity order", () => {
      expect(names("r>=rare")).toEqual(["Annie, Fiery", "Recruit"]);
      expect(names("r<rare")).toEqual(["Garen, Rugged", "Buff"]);
    });

    it("uses a supplied rarity order", () => {
      expect(
        names("r>common", all, { rarityOrder: ["epic", "rare", "common", "uncommon", "showcase"] }),
      ).toEqual([]);
    });
  });

  it("matches set and language case-insensitively", () => {
    expect(names("s:sfd")).toEqual(["Annie, Fiery"]);
    expect(names("lang:fr")).toEqual(["Annie, Fiery"]);
  });

  it("matches the collector number without separators", () => {
    expect(names("cn:ogn001")).toEqual(["Garen, Rugged"]);
  });

  describe("dates", () => {
    it("treats a year as the whole year", () => {
      expect(names("date:2025")).toEqual(["Garen, Rugged", "Buff", "Recruit"]);
      expect(names("date>2025")).toEqual(["Annie, Fiery"]);
      expect(names("date<2026-01")).toEqual(["Garen, Rugged", "Buff", "Recruit"]);
    });

    it("compares full dates", () => {
      expect(names("date>=2026-02-13")).toEqual(["Annie, Fiery"]);
    });
  });

  describe("formats", () => {
    it("excludes banned cards, tokens and other-type objects from f:", () => {
      expect(names("f:constructed")).toEqual(["Garen, Rugged"]);
      expect(names("f:standard")).toEqual(["Garen, Rugged"]);
    });

    it("keeps banned cards in a format without that ban", () => {
      expect(names("f:freeform")).toEqual(["Garen, Rugged", "Annie, Fiery"]);
    });

    it("finds banned cards with banned:", () => {
      expect(names("banned:constructed")).toEqual(["Annie, Fiery"]);
      expect(names("banned:standard")).toEqual(["Annie, Fiery"]);
    });
  });

  describe("flags", () => {
    it("matches is: values", () => {
      expect(names("is:foil")).toEqual(["Annie, Fiery"]);
      expect(names("is:altart")).toEqual(["Annie, Fiery"]);
    });

    it("treats not: as a negated is:", () => {
      expect(names("not:foil")).toEqual(["Garen, Rugged", "Buff", "Recruit"]);
    });

    it("matches has: presence", () => {
      expect(names("has:keyword")).toEqual(["Garen, Rugged"]);
      expect(names("-has:image")).toEqual(["Buff"]);
    });
  });

  it("matches custom tags", () => {
    expect(names("ctag:burn")).toEqual(["Annie, Fiery"]);
  });

  it("combines or, groups and negation", () => {
    expect(names("(t:spell or t:champion) -d:chaos")).toEqual(["Garen, Rugged"]);
  });

  it("matches nothing for an invalid clause", () => {
    expect(names("e<=x")).toEqual([]);
  });

  it("orders printings by preference", () => {
    const prices = options.priceLookup;
    expect(
      sortByPreference([annie, garen], "oldest").map((printing) => printing.printingId),
    ).toEqual(["p-garen", "p-annie"]);
    expect(
      sortByPreference([garen, annie], "newest").map((printing) => printing.printingId),
    ).toEqual(["p-annie", "p-garen"]);
    expect(
      sortByPreference([annie, buff, garen], "usd-low", prices).map(
        (printing) => printing.printingId,
      ),
    ).toEqual(["p-garen", "p-annie", "p-buff"]);
  });

  it("caches one predicate per query string", () => {
    expect(searchPredicate("t:unit")).toBe(searchPredicate("t:unit"));
  });
});
