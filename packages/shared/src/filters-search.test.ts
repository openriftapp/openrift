import { describe, expect, it } from "vitest";

import { toSearchTerm } from "./filters-search.js";
import { emptyFilters, makePrinting } from "./filters-test-helpers.js";
import { filterCards } from "./filters.js";
import type { CardFilters } from "./types/search.js";

describe("toSearchTerm", () => {
  it("returns null when the text folds away", () => {
    expect(toSearchTerm("'")).toBeNull();
    expect(toSearchTerm("   ")).toBeNull();
  });

  it("keeps a hyphen, which the fold does not remove", () => {
    expect(toSearchTerm("-")).toEqual({ text: "-", folded: "-", squashed: "" });
  });
});

describe("filterCards search folding", () => {
  // Real catalogue values: fixTypography stores U+2019 apostrophes, U+2212 for
  // the minus in "-1", and keywords are hyphenated.
  const printings = [
    makePrinting({
      printingId: "OGN-101",
      shortCode: "OGN-101",
      artist: "黯荧岛Dark Glow",
      printedRulesText: "Give a unit −1 :rb_might:. [Equip] a Gear.",
      flavorText: "Sweet revenge—it’s épéeback.",
      card: {
        slug: "dorans-shield",
        name: "Doran’s Shield",
        keywords: ["Quick-Draw"],
        tags: ["Kha’Zix"],
      },
    }),
    makePrinting({
      printingId: "OGN-269",
      shortCode: "OGN-269",
      artist: "Jane Doe",
      printedName: "波比，扶弱使者",
      printedRulesText: "Deal 1 damage. Draw a card.",
      card: {
        slug: "kaisa-survivor",
        name: "Kai’Sa, Survivor",
        keywords: ["Shield"],
        tags: ["Sentinel"],
      },
    }),
    makePrinting({
      printingId: "OGN-400",
      shortCode: "OGN-400",
      artist: "Jane Doe",
      printedRulesText: "Equip a Gear to deal 1 damage.",
      card: { slug: "sterak-gage", name: "Sterak’s Gage", keywords: [], tags: [] },
    }),
  ];

  const names = (filters: Partial<CardFilters>) =>
    filterCards(printings, emptyFilters(filters)).map((p) => p.card.name);

  describe("names", () => {
    it.each([
      ["curly apostrophe, as stored", "Doran’s Shield"],
      ["straight apostrophe, as typed", "Doran's Shield"],
      ["apostrophe omitted", "dorans shield"],
      ["single word, apostrophe omitted", "dorans"],
      ["no spaces at all", "doransshield"],
    ])("finds Doran’s Shield by %s", (_label, search) => {
      expect(names({ search })).toEqual(["Doran’s Shield"]);
    });

    it.each([["kaisa"], ["kai'sa"], ["Kai'Sa, Survivor"], ["kaisa survivor"], ["kaisasurvivor"]])(
      "finds Kai’Sa, Survivor by %s",
      (search) => {
        expect(names({ search })).toEqual(["Kai’Sa, Survivor"]);
      },
    );

    it("matches a localized printed name typed with an ASCII comma", () => {
      // Stored with the fullwidth comma U+FF0C, which NFKD folds to ",".
      expect(names({ search: "波比,扶弱使者" })).toEqual(["Kai’Sa, Survivor"]);
    });
  });

  describe("card text", () => {
    it("finds a minus-sign value typed as an ASCII hyphen", () => {
      // Stored as U+2212, the actual minus sign, not an ASCII hyphen.
      expect(names({ search: "o:-1 o:might" })).toEqual(["Doran’s Shield"]);
    });

    it("still finds it when the minus sign is typed correctly", () => {
      expect(names({ search: "o:−1 o:might" })).toEqual(["Doran’s Shield"]);
    });

    it("keeps bracketed keyword searches precise", () => {
      // Two cards mention Equip; only one brackets it. The brackets must survive
      // the fold or this widens to both.
      expect(names({ search: "o:equip" })).toEqual(["Doran’s Shield", "Sterak’s Gage"]);
      expect(names({ search: "o:[equip]" })).toEqual(["Doran’s Shield"]);
    });

    it("does not join words across punctuation in prose", () => {
      // Squashing prose would incorrectly match "damage. Draw".
      expect(names({ search: "o:damage" })).toEqual(["Kai’Sa, Survivor", "Sterak’s Gage"]);
      expect(names({ search: "o:damagedraw" })).toEqual([]);
    });

    it("does not let a sentence boundary vanish", () => {
      expect(names({ search: 'o:"1 damage"' })).toEqual(["Kai’Sa, Survivor", "Sterak’s Gage"]);
      expect(names({ search: 'o:"damage draw"' })).toEqual([]);
    });
  });

  describe("flavor text", () => {
    it("finds an accented word typed without accents", () => {
      expect(names({ search: "ft:epeeback" })).toEqual(["Doran’s Shield"]);
    });

    it("finds an apostrophe word typed with a straight quote", () => {
      expect(names({ search: "ft:it's" })).toEqual(["Doran’s Shield"]);
    });

    it("folds the em dash to a hyphen", () => {
      expect(names({ search: "ft:revenge-it" })).toEqual(["Doran’s Shield"]);
    });
  });

  describe("keywords, tags, artist and short code", () => {
    it("finds a hyphenated keyword typed without the hyphen", () => {
      expect(names({ search: "kw:quickdraw" })).toEqual(["Doran’s Shield"]);
    });

    it("still finds it with the hyphen", () => {
      expect(names({ search: "kw:quick-draw" })).toEqual(["Doran’s Shield"]);
    });

    it("finds a tag with a curly apostrophe typed straight", () => {
      expect(names({ search: "otag:kha'zix" })).toEqual(["Doran’s Shield"]);
    });

    it("finds a short code typed without the hyphen", () => {
      expect(names({ search: "cn:ogn269" })).toEqual(["Kai’Sa, Survivor"]);
    });

    it("keeps a CJK artist name searchable", () => {
      // normalizeNameForIdentity strips CJK characters, keeping only the Latin half.
      expect(names({ search: "a:黯荧岛" })).toEqual(["Doran’s Shield"]);
    });

    it("finds the Latin half of a mixed-script artist name", () => {
      expect(names({ search: 'a:"dark glow"' })).toEqual(["Doran’s Shield"]);
    });
  });

  describe("degenerate queries", () => {
    it("treats an apostrophe-only query as no search rather than matching all", () => {
      expect(names({ search: "'" })).toHaveLength(printings.length);
    });

    it("drops a folded-away term but keeps its neighbours", () => {
      expect(names({ search: "dorans ’" })).toEqual(["Doran’s Shield"]);
    });
  });

  describe("keyword translation reverse map", () => {
    it("resolves a translated label whose key was folded", () => {
      // buildTranslationReverseMap folds its keys; the lookup must use the
      // folded term, not a merely lowercased one.
      const result = filterCards(printings, emptyFilters({ search: "kw:护盾" }), {
        keywordReverseMap: new Map([["护盾", "Shield"]]),
      });
      expect(result.map((p) => p.card.name)).toEqual(["Kai’Sa, Survivor"]);
    });
  });
});
