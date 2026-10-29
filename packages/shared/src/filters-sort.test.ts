import { describe, expect, it } from "vitest";

import { sortCards } from "./filters-sort.js";
import { getTestPrice, makePrinting, TEST_ORDERS, withPrice } from "./filters-test-helpers.js";

describe("sortCards", () => {
  // Matches `makePrinting`'s default set, plus a second main set that sorts
  // after it despite its printings' alphabetically-earlier short codes.
  const SET_ALPHA_ID = "00000000-0000-0000-0000-0000000000a1";
  const SET_BETA_ID = "00000000-0000-0000-0000-0000000000a2";
  const SET_PROMO_ID = "00000000-0000-0000-0000-0000000000a3";
  const SETS = [
    { id: SET_ALPHA_ID, setType: "main" as const },
    { id: SET_BETA_ID, setType: "main" as const },
  ];

  const printings = [
    makePrinting({
      printingId: "SET1-003:epic:normal:",
      shortCode: "SET1-003",
      rarity: "epic",
      cardId: "SET1-003",
      card: {
        name: "Charlie",
        types: ["unit"],
        superTypes: [],
        domains: [],
        energy: 5,
        might: 0,
        power: 0,
        keywords: [],
        tags: [],
        mightBonus: null,
        errata: null,
      },
    }),
    makePrinting({
      printingId: "SET1-001:rare:normal:",
      shortCode: "SET1-001",
      rarity: "common",
      cardId: "SET1-001",
      card: {
        name: "Alpha",
        types: ["unit"],
        superTypes: [],
        domains: [],
        energy: 2,
        might: 0,
        power: 0,
        keywords: [],
        tags: [],
        mightBonus: null,
        errata: null,
      },
    }),
    makePrinting({
      printingId: "SET1-002:common:foil:",
      shortCode: "SET1-002",
      rarity: "rare",
      cardId: "SET1-002",
      card: {
        name: "Bravo",
        types: ["unit"],
        superTypes: [],
        domains: [],
        energy: 2,
        might: 0,
        power: 0,
        keywords: [],
        tags: [],
        mightBonus: null,
        errata: null,
      },
    }),
  ];

  it("does not mutate the original array", () => {
    const original = [...printings];
    sortCards(printings, "name");
    expect(printings).toEqual(original);
  });

  it("sorts by name alphabetically", () => {
    const result = sortCards(printings, "name");
    expect(result.map((p) => p.card.name)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("files a Legend under its champion, not its stored epithet", () => {
    const azir = makePrinting({
      printingId: "SET1-004:epic:normal:",
      shortCode: "SET1-004",
      rarity: "epic",
      cardId: "SET1-004",
      card: {
        name: "Emperor of the Sands",
        types: ["legend"],
        superTypes: [],
        domains: [],
        energy: null,
        might: 0,
        power: 0,
        keywords: [],
        tags: ["Azir"],
        mightBonus: null,
        errata: null,
      },
    });
    const result = sortCards([...printings, azir], "name");
    // Between Alpha and Bravo as "Azir, …", not after Charlie as "Emperor …".
    expect(result.map((p) => p.card.name)).toEqual([
      "Alpha",
      "Emperor of the Sands",
      "Bravo",
      "Charlie",
    ]);
  });

  it("sorts by id (card number within one set)", () => {
    const result = sortCards(printings, "id", { sets: SETS });
    expect(result.map((p) => p.shortCode)).toEqual(["SET1-001", "SET1-002", "SET1-003"]);
  });

  it("sorts by id across sets in set order, not by the code's set prefix", () => {
    // "AAA" sorts ahead of "SET1" alphabetically, but Set Alpha comes first in
    // the catalog, so its printings lead.
    const beta = makePrinting({
      printingId: "AAA-001:common:normal:",
      shortCode: "AAA-001",
      setId: SET_BETA_ID,
      cardId: "AAA-001",
    });
    const result = sortCards([beta, ...printings], "id", { sets: SETS });
    expect(result.map((p) => p.shortCode)).toEqual(["SET1-001", "SET1-002", "SET1-003", "AAA-001"]);
  });

  it("sorts a supplemental set's printings after the main sets", () => {
    const promo = makePrinting({
      printingId: "PRM-001:common:normal:",
      shortCode: "PRM-001",
      setId: SET_PROMO_ID,
      cardId: "PRM-001",
    });
    // Promo leads the catalog array here, to prove it still sorts last.
    const result = sortCards([...printings, promo], "id", {
      sets: [{ id: SET_PROMO_ID, setType: "supplemental" }, ...SETS],
    });
    expect(result.at(-1)?.shortCode).toBe("PRM-001");
  });

  it("sorts a printing from an unknown set last", () => {
    const stray = makePrinting({
      printingId: "ZZZ-001:common:normal:",
      shortCode: "AAA-001",
      setId: "set-not-in-catalog",
      cardId: "ZZZ-001",
    });
    const result = sortCards([stray, ...printings], "id", { sets: SETS });
    expect(result.at(-1)?.setId).toBe("set-not-in-catalog");
  });

  it("breaks a name tie by set order, then card number", () => {
    const reprint = makePrinting({
      printingId: "AAA-009:common:normal:",
      shortCode: "AAA-009",
      setId: SET_BETA_ID,
      cardId: "AAA-009",
      card: { name: "Alpha" },
    });
    const alpha = printings.find((p) => p.card.name === "Alpha");
    const result = sortCards([reprint, alpha as typeof reprint], "name", { sets: SETS });
    expect(result.map((p) => p.shortCode)).toEqual(["SET1-001", "AAA-009"]);
  });

  it("throws when sorting by id without the catalog's sets", () => {
    // A card ID's set can't be derived from the printing alone.
    expect(() => sortCards(printings, "id")).toThrow("`sets` is required");
  });

  it("sorts by energy, breaking ties by shortCode", () => {
    const result = sortCards(printings, "energy");
    // Alpha(2) and Bravo(2) tied → SET1-001 < SET1-002; then Charlie(5)
    expect(result.map((p) => p.card.name)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("sorts by rarity using RARITY_ORDER, breaking ties by shortCode", () => {
    const result = sortCards(printings, "rarity", { rarityOrder: TEST_ORDERS.rarities });
    expect(result.map((p) => p.card.name)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("keeps shortCode tiebreaker ascending when rarity sort is desc", () => {
    const tied = [
      makePrinting({
        shortCode: "SET1-003",
        rarity: "common",
        cardId: "c3",
        card: {
          name: "Zeta",
          types: ["unit"],
          superTypes: [],
          domains: [],
          energy: 1,
          might: 0,
          power: 0,
          keywords: [],
          tags: [],
          mightBonus: null,
          errata: null,
        },
      }),
      makePrinting({
        shortCode: "SET1-001",
        rarity: "common",
        cardId: "c1",
        card: {
          name: "Alpha",
          types: ["unit"],
          superTypes: [],
          domains: [],
          energy: 1,
          might: 0,
          power: 0,
          keywords: [],
          tags: [],
          mightBonus: null,
          errata: null,
        },
      }),
      makePrinting({
        shortCode: "SET1-002",
        rarity: "rare",
        cardId: "c2",
        card: {
          name: "Bravo",
          types: ["unit"],
          superTypes: [],
          domains: [],
          energy: 1,
          might: 0,
          power: 0,
          keywords: [],
          tags: [],
          mightBonus: null,
          errata: null,
        },
      }),
    ];
    const result = sortCards(tied, "rarity", {
      sortDir: "desc",
      rarityOrder: TEST_ORDERS.rarities,
    });
    expect(result.map((p) => p.shortCode)).toEqual(["SET1-002", "SET1-001", "SET1-003"]);
  });

  describe("price sort", () => {
    const pricePrintings = [
      withPrice(
        makePrinting({
          cardId: "e",
          card: {
            name: "Expensive",
            types: ["unit"],
            superTypes: [],
            domains: [],
            energy: null,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: null,
          },
        }),
        20,
      ),
      makePrinting({
        cardId: "n",
        card: {
          name: "No Price",
          types: ["unit"],
          superTypes: [],
          domains: [],
          energy: null,
          might: null,
          power: null,
          keywords: [],
          tags: [],
          mightBonus: null,
          errata: null,
        },
      }),
      withPrice(
        makePrinting({
          cardId: "c",
          card: {
            name: "Cheap",
            types: ["unit"],
            superTypes: [],
            domains: [],
            energy: null,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: null,
          },
        }),
        1,
      ),
    ];

    it("sorts by price ascending, nulls last", () => {
      const result = sortCards(pricePrintings, "price", { getPrice: getTestPrice });
      expect(result.map((p) => p.card.name)).toEqual(["Cheap", "Expensive", "No Price"]);
    });

    it("breaks price ties by shortCode", () => {
      const tiedPrintings = [
        withPrice(
          makePrinting({
            shortCode: "SET1-002",
            cardId: "b",
            card: {
              name: "Bravo",
              types: ["unit"],
              superTypes: [],
              domains: [],
              energy: null,
              might: null,
              power: null,
              keywords: [],
              tags: [],
              mightBonus: null,
              errata: null,
            },
          }),
          5,
        ),
        withPrice(
          makePrinting({
            shortCode: "SET1-001",
            cardId: "a",
            card: {
              name: "Alpha",
              types: ["unit"],
              superTypes: [],
              domains: [],
              energy: null,
              might: null,
              power: null,
              keywords: [],
              tags: [],
              mightBonus: null,
              errata: null,
            },
          }),
          5,
        ),
      ];
      const result = sortCards(tiedPrintings, "price", { getPrice: getTestPrice });
      expect(result.map((p) => p.card.name)).toEqual(["Alpha", "Bravo"]);
    });

    it("sorts all-null-price printings by shortCode", () => {
      const nullPrintings = [
        makePrinting({
          shortCode: "SET1-002",
          cardId: "z",
          card: {
            name: "Zed",
            types: ["unit"],
            superTypes: [],
            domains: [],
            energy: null,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: null,
          },
        }),
        makePrinting({
          shortCode: "SET1-001",
          cardId: "a",
          card: {
            name: "Amy",
            types: ["unit"],
            superTypes: [],
            domains: [],
            energy: null,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: null,
          },
        }),
      ];
      const result = sortCards(nullPrintings, "price", { getPrice: getTestPrice });
      expect(result.map((p) => p.card.name)).toEqual(["Amy", "Zed"]);
    });

    it("keeps nulls last when sorting price desc", () => {
      const priceMix = [
        makePrinting({
          shortCode: "SET1-002",
          cardId: "n",
          card: {
            name: "No Price",
            types: ["unit"],
            superTypes: [],
            domains: [],
            energy: null,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: null,
          },
        }),
        withPrice(
          makePrinting({
            shortCode: "SET1-001",
            cardId: "m",
            card: {
              name: "Mid Price",
              types: ["unit"],
              superTypes: [],
              domains: [],
              energy: null,
              might: null,
              power: null,
              keywords: [],
              tags: [],
              mightBonus: null,
              errata: null,
            },
          }),
          10,
        ),
        withPrice(
          makePrinting({
            shortCode: "SET1-003",
            cardId: "h",
            card: {
              name: "High Price",
              types: ["unit"],
              superTypes: [],
              domains: [],
              energy: null,
              might: null,
              power: null,
              keywords: [],
              tags: [],
              mightBonus: null,
              errata: null,
            },
          }),
          50,
        ),
      ];
      const result = sortCards(priceMix, "price", { sortDir: "desc", getPrice: getTestPrice });
      expect(result.map((p) => p.card.name)).toEqual(["High Price", "Mid Price", "No Price"]);
    });

    it("keeps nulls last when sorting energy desc", () => {
      const energyMix = [
        makePrinting({
          shortCode: "SET1-002",
          cardId: "n",
          card: {
            name: "No Energy",
            types: ["spell"],
            superTypes: [],
            domains: [],
            energy: null,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: null,
          },
        }),
        makePrinting({
          shortCode: "SET1-001",
          cardId: "h",
          card: {
            name: "High Energy",
            types: ["unit"],
            superTypes: [],
            domains: [],
            energy: 8,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: null,
          },
        }),
        makePrinting({
          shortCode: "SET1-003",
          cardId: "l",
          card: {
            name: "Low Energy",
            types: ["unit"],
            superTypes: [],
            domains: [],
            energy: 1,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: null,
          },
        }),
      ];
      const result = sortCards(energyMix, "energy", { sortDir: "desc" });
      expect(result.map((p) => p.card.name)).toEqual(["High Energy", "Low Energy", "No Energy"]);
    });

    it("uses custom getPrice for price sort", () => {
      const printingsWithCustomPrice = [
        makePrinting({
          shortCode: "SET1-001",
          cardId: "a",
          card: {
            name: "Alpha",
            types: ["unit"],
            superTypes: [],
            domains: [],
            energy: null,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: null,
          },
        }),
        makePrinting({
          shortCode: "SET1-002",
          cardId: "b",
          card: {
            name: "Bravo",
            types: ["unit"],
            superTypes: [],
            domains: [],
            energy: null,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: null,
          },
        }),
      ];
      const result = sortCards(printingsWithCustomPrice, "price", {
        sortDir: "desc",
        getPrice: (p) => (p.cardId === "a" ? 100 : 1),
      });
      expect(result.map((p) => p.card.name)).toEqual(["Alpha", "Bravo"]);
    });
  });

  describe("energy sort with null values", () => {
    it("pushes null energy to the end", () => {
      const energyPrintings = [
        makePrinting({
          cardId: "n",
          card: {
            name: "No Energy",
            types: ["spell"],
            superTypes: [],
            domains: [],
            energy: null,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: null,
          },
        }),
        makePrinting({
          cardId: "l",
          card: {
            name: "Low Energy",
            types: ["unit"],
            superTypes: [],
            domains: [],
            energy: 1,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: null,
          },
        }),
      ];
      const result = sortCards(energyPrintings, "energy");
      expect(result.map((p) => p.card.name)).toEqual(["Low Energy", "No Energy"]);
    });

    it("sorts non-null energy before null, null by shortCode", () => {
      const energyPrintings = [
        makePrinting({
          shortCode: "SET1-002",
          cardId: "z",
          card: {
            name: "Zeta Null",
            types: ["spell"],
            superTypes: [],
            domains: [],
            energy: null,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: null,
          },
        }),
        makePrinting({
          shortCode: "SET1-001",
          cardId: "a",
          card: {
            name: "Alpha Null",
            types: ["spell"],
            superTypes: [],
            domains: [],
            energy: null,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: null,
          },
        }),
        makePrinting({
          cardId: "h",
          card: {
            name: "High Energy",
            types: ["unit"],
            superTypes: [],
            domains: [],
            energy: 8,
            might: null,
            power: null,
            keywords: [],
            tags: [],
            mightBonus: null,
            errata: null,
          },
        }),
      ];
      const result = sortCards(energyPrintings, "energy");
      expect(result.map((p) => p.card.name)).toEqual(["High Energy", "Alpha Null", "Zeta Null"]);
    });
  });

  it("returns empty array when given empty input", () => {
    expect(sortCards([], "name")).toEqual([]);
    expect(sortCards([], "id", { sets: SETS })).toEqual([]);
    expect(sortCards([], "energy")).toEqual([]);
    expect(sortCards([], "rarity", { rarityOrder: TEST_ORDERS.rarities })).toEqual([]);
    expect(sortCards([], "price")).toEqual([]);
  });

  it("handles single-element array for all sort modes", () => {
    const single = [makePrinting({ cardId: "x", card: { name: "Solo" } })];
    expect(sortCards(single, "name")).toHaveLength(1);
    expect(sortCards(single, "id", { sets: SETS })).toHaveLength(1);
    expect(sortCards(single, "energy")).toHaveLength(1);
    expect(sortCards(single, "rarity", { rarityOrder: TEST_ORDERS.rarities })).toHaveLength(1);
    expect(sortCards(single, "price")).toHaveLength(1);
  });

  it("throws when sortBy is 'rarity' but no rarityOrder is supplied", () => {
    expect(() => sortCards([makePrinting()], "rarity")).toThrow(/rarityOrder/u);
  });

  describe("search orders", () => {
    const first = makePrinting({
      printingId: "a",
      shortCode: "SET1-001",
      artist: "Zed Studio",
      setReleasedAt: "2025-10-31",
      card: { name: "A", might: 2, power: null },
    });
    const second = makePrinting({
      printingId: "b",
      shortCode: "SET1-002",
      artist: "Alpha Studio",
      setReleasedAt: "2026-02-13",
      card: { name: "B", might: 5, power: 1 },
    });
    const third = makePrinting({
      printingId: "c",
      shortCode: "SET1-003",
      artist: "",
      card: { name: "C", might: null, power: 2 },
    });
    const ids = (sorted: ReturnType<typeof sortCards>) =>
      sorted.map((printing) => printing.printingId);

    it("sorts by might and power with missing values last", () => {
      expect(ids(sortCards([first, second, third], "might", { sortDir: "desc" }))).toEqual([
        "b",
        "a",
        "c",
      ]);
      expect(ids(sortCards([third, second, first], "power"))).toEqual(["b", "c", "a"]);
    });

    it("sorts by artist and release date with missing values last", () => {
      expect(ids(sortCards([first, second, third], "artist"))).toEqual(["b", "a", "c"]);
      expect(ids(sortCards([third, first, second], "released", { sortDir: "desc" }))).toEqual([
        "b",
        "a",
        "c",
      ]);
    });

    it("sorts by one marketplace's price", () => {
      const prices: Record<string, number> = { a: 3, b: 1 };
      expect(
        ids(
          sortCards([first, second, third], "usd", {
            getMarketPrice: (printing, marketplace) =>
              marketplace === "tcgplayer" ? prices[printing.printingId] : undefined,
          }),
        ),
      ).toEqual(["b", "a", "c"]);
    });

    it("sorts by set like the collector order", () => {
      expect(ids(sortCards([third, first, second], "set"))).toEqual(["a", "b", "c"]);
    });
  });
});
