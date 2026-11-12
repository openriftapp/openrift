import { describe, expect, it } from "vitest";

import { emptyFilters, getTestPrice, makePrinting, withPrice } from "./filters-test-helpers.js";
import { cardFiltersPredicate, filterCards } from "./filters.js";
import { testSearchContext } from "./test-factories.js";
import type { CardFilters } from "./types/search.js";
import { NONE } from "./types/search.js";

describe("filterCards", () => {
  const printings = [
    makePrinting({
      printingId: "SET1-001:rare:normal:",
      shortCode: "SET1-001",
      setSlug: "Set Alpha",
      rarity: "rare",
      artVariant: "normal",
      finish: "normal",
      images: [{ imageId: "019d6c25-b081-74b3-a901-64da4ae01dab" }],
      artist: "Alice",
      cardId: "SET1-001",
      card: {
        name: "Fire Dragon",
        types: ["unit"],
        superTypes: ["champion"],
        domains: ["fury"],
        energy: 5,
        might: 4,
        power: 6,
        keywords: ["Shield", "Burn"],
        tags: ["Dragon", "Warrior"],
        mightBonus: 0,
        errata: [
          {
            language: "EN",
            correctedRulesText: "A fiery beast",
            correctedEffectText: "Deal 3 damage",
            source: "Test",
            sourceUrl: null,
            effectiveDate: null,
          },
        ],
      },
    }),
    makePrinting({
      printingId: "SET1-002:common:foil:",
      shortCode: "SET1-002",
      setSlug: "Set Alpha",
      rarity: "common",
      artVariant: "normal",
      finish: "foil",
      images: [{ imageId: "019d6c25-b081-74b3-a901-64da4ae01dab" }],
      artist: "Bob",
      cardId: "SET1-002",
      card: {
        name: "Ice Golem",
        types: ["unit"],
        superTypes: [],
        domains: ["calm"],
        energy: 3,
        might: 6,
        power: 2,
        keywords: ["Freeze"],
        tags: ["Golem"],
        mightBonus: 0,
        errata: [
          {
            language: "EN",
            correctedRulesText: "A frozen construct",
            correctedEffectText: "Freeze target",
            source: "Test",
            sourceUrl: null,
            effectiveDate: null,
          },
        ],
      },
    }),
    makePrinting({
      printingId: "SET2-001:epic:normal:",
      shortCode: "SET2-001a",
      setSlug: "Set Beta",
      rarity: "epic",
      artVariant: "altart",
      finish: "normal",
      images: [{ imageId: "019d6c25-b081-74b3-a901-64da4ae01dab" }],
      artist: "Carol",
      cardId: "SET2-001",
      card: {
        name: "Mind Weaver",
        types: ["spell"],
        superTypes: ["basic"],
        domains: ["mind", "chaos"],
        energy: 2,
        might: 0,
        power: 0,
        keywords: [],
        tags: ["Psychic"],
        mightBonus: 0,
        errata: [
          {
            language: "EN",
            correctedRulesText: "Manipulate thoughts",
            correctedEffectText: "Draw 2 cards",
            source: "Test",
            sourceUrl: null,
            effectiveDate: null,
          },
        ],
      },
    }),
  ];

  it("returns all printings when filters are empty", () => {
    const result = filterCards(printings, emptyFilters(), testSearchContext());
    expect(result).toHaveLength(3);
  });

  it("filters by bare search term using default scope (name)", () => {
    const result = filterCards(printings, emptyFilters({ search: "dragon" }), testSearchContext());
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Fire Dragon");
  });

  it("bare search is case-insensitive", () => {
    const result = filterCards(printings, emptyFilters({ search: "DRAGON" }), testSearchContext());
    expect(result).toHaveLength(1);
  });

  it("searches tags with tag:", () => {
    const result = filterCards(
      printings,
      emptyFilters({ search: "tag:warrior" }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Fire Dragon");
  });

  it("prefixed search targets specific field", () => {
    const result = filterCards(
      printings,
      emptyFilters({ search: "kw:shield" }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Fire Dragon");
  });

  it("bare words keep the search scope when mixed with keyed terms", () => {
    const result = filterCards(
      printings,
      emptyFilters({ search: "kw:freeze golem" }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Ice Golem");
  });

  it("all search terms must match (AND semantics)", () => {
    const result = filterCards(
      printings,
      emptyFilters({ search: "fire golem" }),
      testSearchContext(),
    );
    expect(result).toHaveLength(0);
  });

  it("search by artist prefix", () => {
    const result = filterCards(printings, emptyFilters({ search: "a:alice" }), testSearchContext());
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Fire Dragon");
  });

  it("matches a whole collector code, variant letter optional", () => {
    const result = filterCards(
      printings,
      emptyFilters({ search: "cn:SET2-001" }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Mind Weaver");
  });

  it("search by card text prefix matches description", () => {
    const result = filterCards(printings, emptyFilters({ search: "o:fiery" }), testSearchContext());
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Fire Dragon");
  });

  it("search by card text prefix matches effect", () => {
    const result = filterCards(printings, emptyFilters({ search: "o:draw" }), testSearchContext());
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Mind Weaver");
  });

  it("search by tags prefix", () => {
    const result = filterCards(
      printings,
      emptyFilters({ search: "tag:psychic" }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Mind Weaver");
  });

  it("filters by set", () => {
    const result = filterCards(
      printings,
      emptyFilters({ sets: ["Set Beta"] }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Mind Weaver");
  });

  it("filters by multiple sets (OR)", () => {
    const result = filterCards(
      printings,
      emptyFilters({ sets: ["Set Alpha", "Set Beta"] }),
      testSearchContext(),
    );
    expect(result).toHaveLength(3);
  });

  it("filters by language", () => {
    const catalog = [
      makePrinting({
        printingId: "en-printing",
        language: "EN",
        card: { slug: "c1", name: "Alpha" },
      }),
      makePrinting({
        printingId: "de-printing",
        language: "DE",
        card: { slug: "c2", name: "Beta" },
      }),
      makePrinting({
        printingId: "ja-printing",
        language: "JA",
        card: { slug: "c3", name: "Gamma" },
      }),
    ];
    const result = filterCards(catalog, emptyFilters({ languages: ["EN"] }), testSearchContext());
    expect(result).toHaveLength(1);
    expect(result[0]!.printingId).toBe("en-printing");
  });

  it("filters by multiple languages (OR)", () => {
    const catalog = [
      makePrinting({
        printingId: "en-printing",
        language: "EN",
        card: { slug: "c1", name: "Alpha" },
      }),
      makePrinting({
        printingId: "de-printing",
        language: "DE",
        card: { slug: "c2", name: "Beta" },
      }),
      makePrinting({
        printingId: "ja-printing",
        language: "JA",
        card: { slug: "c3", name: "Gamma" },
      }),
    ];
    const result = filterCards(
      catalog,
      emptyFilters({ languages: ["EN", "DE"] }),
      testSearchContext(),
    );
    expect(result).toHaveLength(2);
  });

  it("shows all printings when languages filter is empty", () => {
    const catalog = [
      makePrinting({
        printingId: "en-printing",
        language: "EN",
        card: { slug: "c1", name: "Alpha" },
      }),
      makePrinting({
        printingId: "de-printing",
        language: "DE",
        card: { slug: "c2", name: "Beta" },
      }),
    ];
    const result = filterCards(catalog, emptyFilters({ languages: [] }), testSearchContext());
    expect(result).toHaveLength(2);
  });

  it("filters by rarity", () => {
    const result = filterCards(
      printings,
      emptyFilters({ rarities: ["common"] }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Ice Golem");
  });

  it("filters by multiple rarities (OR)", () => {
    const result = filterCards(
      printings,
      emptyFilters({ rarities: ["rare", "epic"] }),
      testSearchContext(),
    );
    expect(result).toHaveLength(2);
  });

  it("filters by card type", () => {
    const result = filterCards(printings, emptyFilters({ types: ["spell"] }), testSearchContext());
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Mind Weaver");
  });

  it("matches multi-type cards under every type they carry", () => {
    const unitGear = makePrinting({
      printingId: "p-dual",
      cardId: "c-dual",
      card: { name: "Hexcore Carrier", types: ["unit", "gear"] },
    });
    const all = [...printings, unitGear];
    const byUnit = filterCards(all, emptyFilters({ types: ["unit"] }), testSearchContext());
    const byGear = filterCards(all, emptyFilters({ types: ["gear"] }), testSearchContext());
    expect(byUnit.map((p) => p.printingId)).toContain("p-dual");
    expect(byGear.map((p) => p.printingId)).toContain("p-dual");
    const excluded = filterCards(
      all,
      emptyFilters({ typesExclude: ["gear"] }),
      testSearchContext(),
    );
    expect(excluded.map((p) => p.printingId)).not.toContain("p-dual");
  });

  it("filters by superType", () => {
    const result = filterCards(
      printings,
      emptyFilters({ superTypes: ["champion"] }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Fire Dragon");
  });

  it("printings with no matching superType are excluded", () => {
    const result = filterCards(
      printings,
      emptyFilters({ superTypes: ["champion"] }),
      testSearchContext(),
    );
    expect(result.find((p) => p.card.name === "Ice Golem")).toBeUndefined();
  });

  it("filters by domain", () => {
    const result = filterCards(printings, emptyFilters({ domains: ["fury"] }), testSearchContext());
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Fire Dragon");
  });

  it("matches multi-domain printings", () => {
    const result = filterCards(
      printings,
      emptyFilters({ domains: ["chaos"] }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Mind Weaver");
  });

  it("matches either domain of a multi-domain card", () => {
    const result = filterCards(printings, emptyFilters({ domains: ["mind"] }), testSearchContext());
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Mind Weaver");
  });

  it("keeps a card on two selected domains only when all its domains are selected", () => {
    const filters = emptyFilters({ domains: ["fury", "mind"] });
    const names = printings.filter(cardFiltersPredicate(filters)).map((p) => p.card.name);

    expect(names).toEqual(["Fire Dragon"]);
  });

  it("filters by energy min", () => {
    const result = filterCards(
      printings,
      emptyFilters({ energy: { min: 4, max: null } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Fire Dragon");
  });

  it("filters by energy max", () => {
    const result = filterCards(
      printings,
      emptyFilters({ energy: { min: null, max: 2 } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Mind Weaver");
  });

  it("filters by energy range", () => {
    const result = filterCards(
      printings,
      emptyFilters({ energy: { min: 3, max: 5 } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(2);
  });

  it("filters by might min", () => {
    const result = filterCards(
      printings,
      emptyFilters({ might: { min: 5, max: null } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Ice Golem");
  });

  it("filters by power min", () => {
    const result = filterCards(
      printings,
      emptyFilters({ power: { min: 3, max: null } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Fire Dragon");
  });

  it("filters by power max", () => {
    const result = filterCards(
      printings,
      emptyFilters({ power: { min: null, max: 3 } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(2);
  });

  it("filters by might max", () => {
    const result = filterCards(
      printings,
      emptyFilters({ might: { min: null, max: 3 } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Mind Weaver");
  });

  it("filters by artVariant", () => {
    const result = filterCards(
      printings,
      emptyFilters({ artVariants: ["altart"] }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Mind Weaver");
  });

  it("filters by multiple artVariants (OR)", () => {
    const result = filterCards(
      printings,
      emptyFilters({ artVariants: ["normal", "altart"] }),
      testSearchContext(),
    );
    expect(result).toHaveLength(3);
  });

  it("filters by finish", () => {
    const result = filterCards(
      printings,
      emptyFilters({ finishes: ["foil"] }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Ice Golem");
  });

  it("filters by card size", () => {
    const standard = makePrinting({ printingId: "std", size: "standard" });
    const oversized = makePrinting({ printingId: "ovr", size: "oversized" });
    const result = filterCards(
      [standard, oversized],
      emptyFilters({ cardSizes: ["oversized"] }),
      testSearchContext(),
    );
    expect(result.map((p) => p.printingId)).toEqual(["ovr"]);
  });

  it("filters by isSigned", () => {
    const withSigned = [
      makePrinting({
        isSigned: true,
        cardId: "s",
        card: {
          name: "Signed Card",
          types: ["unit"],
          superTypes: [],
          domains: [],
          energy: null,
          might: null,
          power: null,
          keywords: [],
          tags: [],
          mightBonus: null,
          errata: [],
        },
      }),
      makePrinting({
        isSigned: false,
        cardId: "u",
        card: {
          name: "Unsigned Card",
          types: ["unit"],
          superTypes: [],
          domains: [],
          energy: null,
          might: null,
          power: null,
          keywords: [],
          tags: [],
          mightBonus: null,
          errata: [],
        },
      }),
    ];
    const result = filterCards(withSigned, emptyFilters({ isSigned: true }), testSearchContext());
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Signed Card");
  });

  it("filters by isOvernumbered independently of art variant", () => {
    const withOvernumbered = [
      makePrinting({ shortCode: "OGN-303a", isOvernumbered: true, artVariant: "altart" }),
      makePrinting({ shortCode: "OGN-007a", isOvernumbered: false, artVariant: "altart" }),
    ];
    const result = filterCards(
      withOvernumbered,
      emptyFilters({ isOvernumbered: true }),
      testSearchContext(),
    );
    expect(result.map((p) => p.shortCode)).toEqual(["OGN-303a"]);
  });

  it("filters by isOvernumbered=false excluding overnumbered printings", () => {
    const mixed = [
      makePrinting({ shortCode: "OGN-303a", isOvernumbered: true }),
      makePrinting({ shortCode: "OGN-007", isOvernumbered: false }),
    ];
    const result = filterCards(mixed, emptyFilters({ isOvernumbered: false }), testSearchContext());
    expect(result.map((p) => p.shortCode)).toEqual(["OGN-007"]);
  });

  it("filters by hasNoImage to the printings with no image", () => {
    const mixed = [
      makePrinting({ shortCode: "OGN-001", images: [] }),
      makePrinting({ shortCode: "OGN-002" }),
    ];
    const result = filterCards(mixed, emptyFilters({ hasNoImage: true }), testSearchContext());
    expect(result.map((p) => p.shortCode)).toEqual(["OGN-001"]);
  });

  it("filters by hasNoImage=false to the printings that have an image", () => {
    const mixed = [
      makePrinting({ shortCode: "OGN-001", images: [] }),
      makePrinting({ shortCode: "OGN-002" }),
    ];
    const result = filterCards(mixed, emptyFilters({ hasNoImage: false }), testSearchContext());
    expect(result.map((p) => p.shortCode)).toEqual(["OGN-002"]);
  });

  it("ignores hasNoImage when unset", () => {
    const mixed = [
      makePrinting({ shortCode: "OGN-001", images: [] }),
      makePrinting({ shortCode: "OGN-002" }),
    ];
    expect(filterCards(mixed, emptyFilters(), testSearchContext())).toHaveLength(2);
  });

  it("filters by presence.markers=any", () => {
    const withPromo = [
      makePrinting({
        markers: [{ id: "1", slug: "promo", label: "Promo", description: null }],
        cardId: "p",
        card: {
          name: "Promo Card",
          types: ["unit"],
          superTypes: [],
          domains: [],
          energy: null,
          might: null,
          power: null,
          keywords: [],
          tags: [],
          mightBonus: null,
          errata: [],
        },
      }),
      makePrinting({
        markers: [],
        cardId: "r",
        card: {
          name: "Regular Card",
          types: ["unit"],
          superTypes: [],
          domains: [],
          energy: null,
          might: null,
          power: null,
          keywords: [],
          tags: [],
          mightBonus: null,
          errata: [],
        },
      }),
    ];
    const result = filterCards(
      withPromo,
      emptyFilters({ presence: { markers: "any" } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Promo Card");
  });

  it("excludes printings with null price when price filter is active", () => {
    const result = filterCards(
      printings,
      emptyFilters({ price: { min: 0, max: null } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(0);
  });

  it("filters by price range", () => {
    const withPrices = [
      withPrice(
        makePrinting({
          cardId: "c",
          card: {
            name: "Cheap Card",
            types: ["unit"],
            superTypes: [],
            domains: [],
            energy: null,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: [],
          },
        }),
        1,
      ),
      withPrice(
        makePrinting({
          cardId: "e",
          card: {
            name: "Expensive Card",
            types: ["unit"],
            superTypes: [],
            domains: [],
            energy: null,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: [],
          },
        }),
        25,
      ),
      makePrinting({
        cardId: "n",
        card: {
          name: "No Price Card",
          types: ["unit"],
          superTypes: [],
          domains: [],
          energy: null,
          might: null,
          power: null,
          keywords: [],
          tags: [],
          mightBonus: null,
          errata: [],
        },
      }),
    ];

    const result = filterCards(
      withPrices,
      emptyFilters({ price: { min: 5, max: 30 } }),
      testSearchContext({
        getPrice: getTestPrice,
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Expensive Card");
  });

  it("combines multiple filters (AND across dimensions)", () => {
    const result = filterCards(
      printings,
      emptyFilters({
        sets: ["Set Alpha"],
        rarities: ["common"],
        types: ["unit"],
      }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Ice Golem");
  });

  it("returns empty array when no printing matches all filters", () => {
    const result = filterCards(
      printings,
      emptyFilters({
        sets: ["Set Beta"],
        rarities: ["common"],
      }),
      testSearchContext(),
    );
    expect(result).toHaveLength(0);
  });

  it("treats null artVariant as normal when filtering", () => {
    const nullArtVariant = [
      makePrinting({
        artVariant: null as unknown as "normal",
        cardId: "nav",
        card: { name: "Null Art Card" },
      }),
    ];
    const result = filterCards(
      nullArtVariant,
      emptyFilters({ artVariants: ["normal"] }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Null Art Card");
  });

  it("card text search handles null errata", () => {
    const nullTextCard = [
      makePrinting({
        cardId: "nt",
        card: {
          name: "No Text Card",
          types: ["unit"],
          superTypes: [],
          domains: [],
          energy: null,
          might: null,
          power: null,
          keywords: [],
          tags: [],
          mightBonus: null,
          errata: [],
        },
      }),
    ];
    const result = filterCards(
      nullTextCard,
      emptyFilters({ search: "o:something" }),
      testSearchContext(),
    );
    expect(result).toHaveLength(0);
  });

  it("filters by isSigned=false excludes signed cards", () => {
    const cards = [
      makePrinting({
        isSigned: true,
        cardId: "s1",
        card: { name: "Signed Card" },
      }),
      makePrinting({
        isSigned: false,
        cardId: "s2",
        card: { name: "Unsigned Card" },
      }),
    ];
    const result = filterCards(cards, emptyFilters({ isSigned: false }), testSearchContext());
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Unsigned Card");
  });

  it("filters by presence.markers=none excludes marked cards", () => {
    const cards = [
      makePrinting({
        markers: [{ id: "1", slug: "promo", label: "Promo", description: null }],
        cardId: "p1",
        card: { name: "Promo Card" },
      }),
      makePrinting({
        markers: [],
        cardId: "p2",
        card: { name: "Regular Card" },
      }),
    ];
    const result = filterCards(
      cards,
      emptyFilters({ presence: { markers: "none" } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Regular Card");
  });

  it("includes values exactly at range boundaries", () => {
    const result = filterCards(
      printings,
      emptyFilters({ energy: { min: 5, max: 5 } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Fire Dragon");
  });

  it("excludes cards with null energy when energy filter is active", () => {
    const cards = [
      makePrinting({
        cardId: "ne",
        card: {
          name: "No Energy Card",
          types: ["spell"],
          superTypes: [],
          domains: [],
          energy: null,
          might: null,
          power: null,
          keywords: [],
          tags: [],
          mightBonus: null,
          errata: [],
        },
      }),
    ];
    const result = filterCards(
      cards,
      emptyFilters({ energy: { min: 0, max: 10 } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(0);
  });

  it("excludes cards with null might when might filter is active", () => {
    const cards = [
      makePrinting({
        cardId: "nm",
        card: {
          name: "No Might Card",
          types: ["spell"],
          superTypes: [],
          domains: [],
          energy: 3,
          might: null,
          power: null,
          keywords: [],
          tags: [],
          mightBonus: null,
          errata: [],
        },
      }),
    ];
    const result = filterCards(
      cards,
      emptyFilters({ might: { min: 0, max: 10 } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(0);
  });

  it("excludes cards with null power when power filter is active", () => {
    const cards = [
      makePrinting({
        cardId: "np",
        card: {
          name: "No Power Card",
          types: ["spell"],
          superTypes: [],
          domains: [],
          energy: 3,
          might: 2,
          power: null,
          keywords: [],
          tags: [],
          mightBonus: null,
          errata: [],
        },
      }),
    ];
    const result = filterCards(
      cards,
      emptyFilters({ power: { min: 0, max: 10 } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(0);
  });

  it("includes null-energy cards when min is NONE", () => {
    const cards = [
      makePrinting({
        cardId: "1",
        card: { name: "spell", energy: null, might: null, power: null },
      }),
      makePrinting({ cardId: "2", card: { name: "unit", energy: 3 } }),
    ];
    const result = filterCards(
      cards,
      emptyFilters({ energy: { min: NONE, max: 5 } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(2);
  });

  it("isolates null-energy cards when both min and max are NONE", () => {
    const cards = [
      makePrinting({
        cardId: "1",
        card: { name: "spell", energy: null, might: null, power: null },
      }),
      makePrinting({ cardId: "2", card: { name: "unit", energy: 3 } }),
    ];
    const result = filterCards(
      cards,
      emptyFilters({ energy: { min: NONE, max: NONE } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("spell");
  });

  it("excludes null-energy cards when min is a real number", () => {
    const cards = [
      makePrinting({
        cardId: "1",
        card: { name: "spell", energy: null, might: null, power: null },
      }),
      makePrinting({ cardId: "2", card: { name: "unit", energy: 0 } }),
    ];
    const result = filterCards(
      cards,
      emptyFilters({ energy: { min: 0, max: 10 } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("unit");
  });

  it("includes null-might cards when min is NONE", () => {
    const cards = [
      makePrinting({ cardId: "1", card: { name: "spell", might: null } }),
      makePrinting({ cardId: "2", card: { name: "unit", might: 4 } }),
    ];
    const result = filterCards(
      cards,
      emptyFilters({ might: { min: NONE, max: 5 } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(2);
  });

  it("isolates null-power cards when both min and max are NONE", () => {
    const cards = [
      makePrinting({ cardId: "1", card: { name: "spell", power: null } }),
      makePrinting({ cardId: "2", card: { name: "unit", power: 6 } }),
    ];
    const result = filterCards(
      cards,
      emptyFilters({ power: { min: NONE, max: NONE } }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("spell");
  });

  it("returns all printings when search is empty string", () => {
    const result = filterCards(printings, emptyFilters({ search: "" }), testSearchContext());
    expect(result).toHaveLength(3);
  });

  it("empty sets/rarities/types arrays pass all values through", () => {
    const result = filterCards(
      printings,
      emptyFilters({
        sets: [],
        rarities: [],
        types: [],
        domains: [],
        superTypes: [],
        artVariants: [],
        finishes: [],
      }),
      testSearchContext(),
    );
    expect(result).toHaveLength(3);
  });

  it("card text search matches errata effectText only (not rulesText)", () => {
    const cards = [
      makePrinting({
        cardId: "et",
        card: {
          name: "Effect Only",
          types: ["unit"],
          superTypes: [],
          domains: [],
          energy: null,
          might: null,
          power: null,
          keywords: [],
          tags: [],
          mightBonus: null,
          errata: [
            {
              language: "EN",
              correctedRulesText: null,
              correctedEffectText: "Unique effect text here",
              source: "Test",
              sourceUrl: null,
              effectiveDate: null,
            },
          ],
        },
      }),
    ];
    const result = filterCards(cards, emptyFilters({ search: "o:unique" }), testSearchContext());
    expect(result).toHaveLength(1);
  });

  describe("errata in another language", () => {
    const card = {
      name: "Fox-Fire",
      types: ["spell" as const],
      superTypes: [],
      domains: [],
      energy: null,
      might: null,
      power: null,
      keywords: [],
      tags: [],
      mightBonus: null,
      errata: [
        {
          language: "EN",
          correctedRulesText: "Kill any number of units.",
          correctedEffectText: null,
          source: "Test",
          sourceUrl: null,
          effectiveDate: null,
        },
      ],
    };
    const printingsByLanguage = [
      makePrinting({ printingId: "en", cardId: "ff", language: "EN", card }),
      makePrinting({ printingId: "fr", cardId: "ff", language: "FR", card }),
    ];

    it("counts as errata only on printings in the errata's language", () => {
      const result = filterCards(
        printingsByLanguage,
        emptyFilters({ hasErrata: true }),
        testSearchContext(),
      );
      expect(result.map((printing) => printing.printingId)).toEqual(["en"]);
    });

    it("searches the errata text only on printings in the errata's language", () => {
      const result = filterCards(
        printingsByLanguage,
        emptyFilters({ search: "o:any" }),
        testSearchContext(),
      );
      expect(result.map((printing) => printing.printingId)).toEqual(["en"]);
    });
  });

  it("bare search skips the artist field", () => {
    const result = filterCards(printings, emptyFilters({ search: "alice" }), testSearchContext());
    expect(result).toHaveLength(0);
  });

  it("bare search treats a code-shaped word as a card number", () => {
    const result = filterCards(
      printings,
      emptyFilters({ search: "set2-001" }),
      testSearchContext(),
    );
    expect(result.map((printing) => printing.shortCode)).toEqual(["SET2-001a"]);
  });

  it("finds the artist with a:", () => {
    const result = filterCards(printings, emptyFilters({ search: "a:alice" }), testSearchContext());
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Fire Dragon");
  });

  it("filters by distributionChannelSlugs (channel-only filter)", () => {
    const channelNexus = {
      id: "1",
      slug: "nexus-night",
      label: "Nexus Night",
      description: null,
      kind: "event" as const,
      parentId: null,
      childrenLabel: null,
    };
    const channelLaunch = {
      id: "2",
      slug: "launch-day",
      label: "Launch Day",
      description: null,
      kind: "event" as const,
      parentId: null,
      childrenLabel: null,
    };
    const cards = [
      makePrinting({
        markers: [{ id: "m", slug: "promo", label: "Promo", description: null }],
        distributionChannels: [
          { channel: channelNexus, distributionNote: null, ancestorLabels: [] },
        ],
        cardId: "p1",
        card: { name: "Nexus Card" },
      }),
      makePrinting({
        markers: [{ id: "m", slug: "promo", label: "Promo", description: null }],
        distributionChannels: [
          { channel: channelLaunch, distributionNote: null, ancestorLabels: [] },
        ],
        cardId: "p2",
        card: { name: "Launch Card" },
      }),
      makePrinting({
        markers: [],
        distributionChannels: [],
        cardId: "p3",
        card: { name: "Regular Card" },
      }),
    ];
    const result = filterCards(
      cards,
      emptyFilters({ distributionChannelSlugs: ["nexus-night"] }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Nexus Card");
  });

  it("filters by presence.markers=any with specific markerSlugs", () => {
    const cards = [
      makePrinting({
        markers: [{ id: "1", slug: "top-8", label: "Top 8", description: null }],
        cardId: "p1",
        card: { name: "Top 8 Card" },
      }),
      makePrinting({
        markers: [{ id: "2", slug: "promo", label: "Promo", description: null }],
        cardId: "p2",
        card: { name: "Promo Card" },
      }),
    ];
    const result = filterCards(
      cards,
      emptyFilters({ presence: { markers: "any" }, markerSlugs: ["top-8"] }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Top 8 Card");
  });

  it("filters by presence.markers=any with empty markerSlugs returns all marked", () => {
    const cards = [
      makePrinting({
        markers: [{ id: "1", slug: "promo", label: "Promo", description: null }],
        cardId: "p1",
        card: { name: "Promo Card" },
      }),
      makePrinting({
        markers: [],
        cardId: "p2",
        card: { name: "Regular Card" },
      }),
    ];
    const result = filterCards(
      cards,
      emptyFilters({ presence: { markers: "any" }, markerSlugs: [] }),
      testSearchContext(),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.card.name).toBe("Promo Card");
  });
});

describe("filterCards with a language filter", () => {
  const card = { name: "Royal Guard", slug: "royal-guard" };
  const en = makePrinting({
    printingId: "en",
    cardId: "guard",
    language: "EN",
    shortCode: "OGN-010",
    publicCode: "OGN-010/298",
    card,
  });
  const enAlt = makePrinting({
    printingId: "en-alt",
    cardId: "guard",
    language: "EN",
    shortCode: "OGN-010a",
    publicCode: "OGN-010a/298",
    card,
  });
  const fr = makePrinting({
    printingId: "fr",
    cardId: "guard",
    language: "FR",
    shortCode: "OGN-210",
    publicCode: "OGN-210/298",
    printedName: "Garde royal",
    setSlug: "sfd",
    rarity: "epic",
    finish: "foil",
    card,
  });
  const other = makePrinting({
    printingId: "other",
    cardId: "other",
    language: "EN",
    shortCode: "OGN-011",
    publicCode: "OGN-011/298",
    card: { name: "Scout", slug: "scout" },
  });
  const catalog = [en, enAlt, fr, other];
  const ids = (search: string, filters: Partial<CardFilters> = {}, printings = catalog) =>
    filterCards(
      printings,
      emptyFilters({ search, languages: ["EN"], ...filters }),
      testSearchContext(),
    ).map((printing) => printing.printingId);

  it("finds a card by a printed name of a printing in a hidden language", () => {
    expect(ids("garde royal")).toEqual(["en", "en-alt"]);
  });

  it("finds a card by the code of a hidden printing, shown through its shown printings", () => {
    expect(ids("OGN-210")).toEqual(["en", "en-alt"]);
  });

  it("keeps a code of a shown printing pointing at that printing", () => {
    expect(ids("OGN-010a")).toEqual(["en-alt"]);
  });

  it("still shows nothing for a search no printing matches", () => {
    expect(ids("zzz")).toEqual([]);
  });

  it("needs a shown printing for a finish, set or rarity a hidden printing alone meets", () => {
    expect(ids("royal guard", { finishes: ["foil"] })).toEqual([]);
    expect(ids("garde royal", { sets: ["sfd"] })).toEqual([]);
    expect(ids("garde royal r:epic")).toEqual([]);
    expect(ids("OGN-210", { rarities: ["epic"] })).toEqual([]);
  });

  it("combines a hidden-language name with a finish only through a shown printing", () => {
    const foilEn = { ...enAlt, finish: "foil" };
    expect(ids("garde royal", { finishes: ["foil"] })).toEqual([]);
    expect(ids("garde royal", { finishes: ["foil"] }, [en, foilEn, fr, other])).toEqual(["en-alt"]);
  });
});
