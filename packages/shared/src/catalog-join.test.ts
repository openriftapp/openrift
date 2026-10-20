import { afterEach, describe, expect, it, vi } from "vitest";

import { joinCatalog, joinCatalogPrintings } from "./catalog-join";
import type { CatalogResponse } from "./types/api/catalog.js";

const CARD_ID = "00000000-0000-0000-0000-000000000001";
const SET_ID = "00000000-0000-0000-0000-0000000000a1";

function card(overrides: Partial<CatalogResponse["cards"][string]> = {}) {
  return {
    slug: "SET1-001",
    name: "Test Card",
    type: "unit",
    types: ["unit"],
    superTypes: [],
    domains: ["fury"],
    tokenCardIds: [],
    energy: 3,
    might: 2,
    power: 4,
    keywords: [],
    tags: [],
    mightBonus: 0,
    maxCopiesOverride: null,
    errata: null,
    bans: [],
    ...overrides,
  } as CatalogResponse["cards"][string];
}

function printingValue(overrides: Partial<CatalogResponse["printings"][string]> = {}) {
  return {
    cardId: CARD_ID,
    shortCode: "SET1-001",
    setId: SET_ID,
    rarity: "common",
    artVariant: "normal",
    isSigned: false,
    markers: [],
    distributionChannels: [],
    finish: "normal",
    size: "standard",
    images: [],
    artist: "Jane Doe",
    publicCode: "ABCD",
    printedRulesText: null,
    printedEffectText: null,
    flavorText: null,
    printedName: null,
    printedYear: null,
    comment: null,
    language: "EN",
    canonicalRank: 0,
    ...overrides,
  } as CatalogResponse["printings"][string];
}

function catalog(overrides: Partial<CatalogResponse> = {}): CatalogResponse {
  return {
    sets: [
      {
        id: SET_ID,
        slug: "OGN",
        name: "Origins",
        releases: { EN: { releasedAt: "2020-01-01", precision: "day" } },
        setType: "main",
      },
    ],
    cards: { [CARD_ID]: card() },
    printings: { "printing-1": printingValue() },
    totalCopies: 0,
    customTagAssignments: {},
    ...overrides,
  } as CatalogResponse;
}

const GOLD_ID = "00000000-0000-0000-0000-000000000002";

describe("joinCatalogPrintings double-sided", () => {
  function doubleSided(side2CardId: string) {
    return catalog({
      cards: {
        [CARD_ID]: card({ name: "Bird", slug: "bird" }),
        [GOLD_ID]: card({ name: "Gold", slug: "gold" }),
      },
      printings: {
        "printing-1": printingValue({
          images: [{ imageId: "img-bird" }],
          side2: {
            ...printingValue({ cardId: side2CardId, shortCode: "SET1-T05" }),
            faceId: "face-gold",
            images: [{ imageId: "img-gold" }],
          },
        }),
      },
    } as Partial<CatalogResponse>);
  }

  it("expands a double-sided printing into one entry per side", () => {
    const sides = joinCatalogPrintings(doubleSided(GOLD_ID));
    expect(sides.map((side) => [side.printingId, side.side, side.cardId])).toEqual([
      ["printing-1", 1, CARD_ID],
      ["printing-1", 2, GOLD_ID],
    ]);
  });

  it("gives each side its own printed attributes and the physical ones of the printing", () => {
    const [bird, gold] = joinCatalogPrintings(doubleSided(GOLD_ID));
    expect(gold!.shortCode).toBe("SET1-T05");
    expect(gold!.images).toEqual([{ imageId: "img-gold" }]);
    expect(gold!.size).toBe(bird!.size);
    expect(gold!.card.name).toBe("Gold");
  });

  it("does not give side 2 the fallback art pinned on side 1", () => {
    const { side2, ...rest } = doubleSided(GOLD_ID).printings["printing-1"]!;
    const [bird, gold] = joinCatalogPrintings(
      catalog({
        cards: doubleSided(GOLD_ID).cards,
        printings: {
          "printing-1": {
            ...rest,
            fallbackArtMode: "pinned",
            fallbackImageId: "img-pinned",
            side2: { ...side2!, images: [] },
          },
        },
      } as Partial<CatalogResponse>),
    );
    expect(bird!.fallbackArtMode).toBe("pinned");
    expect(gold!.fallbackArtMode).toBeUndefined();
    expect(gold!.fallbackImageId).toBeUndefined();
  });

  it("names the other side on each entry", () => {
    const [bird, gold] = joinCatalogPrintings(doubleSided(GOLD_ID));
    expect(bird!.otherSide).toEqual({
      faceId: "face-gold",
      cardId: GOLD_ID,
      cardName: "Gold",
      cardSlug: "gold",
      shortCode: "SET1-T05",
      imageId: "img-gold",
    });
    expect(gold!.otherSide).toMatchObject({
      faceId: "printing-1",
      cardId: CARD_ID,
      cardName: "Bird",
    });
  });

  it("keeps a printing with the same card on both sides as two entries of that card", () => {
    const sides = joinCatalogPrintings(doubleSided(CARD_ID));
    expect(sides.map((side) => side.cardId)).toEqual([CARD_ID, CARD_ID]);
  });

  it("leaves a single-sided printing without otherSide", () => {
    const [printing] = joinCatalogPrintings(catalog());
    expect(printing!.side).toBe(1);
    expect(printing).not.toHaveProperty("otherSide");
  });
});

describe("joinCatalogPrintings", () => {
  it("restores the map key as the printing id", () => {
    const [printing] = joinCatalogPrintings(catalog());
    expect(printing!.printingId).toBe("printing-1");
  });

  it("attaches the parent set's slug and the printing's card", () => {
    const [printing] = joinCatalogPrintings(catalog());
    expect(printing!.setSlug).toBe("OGN");
    expect(printing!.card.name).toBe("Test Card");
  });

  it("marks a printing released when its language has a past release date", () => {
    const [printing] = joinCatalogPrintings(catalog());
    expect(printing!.setReleased).toBe(true);
  });

  it("resolves release per printing language, not per set", () => {
    const joined = joinCatalogPrintings(
      catalog({
        sets: [
          {
            id: SET_ID,
            slug: "OGN",
            name: "Origins",
            releases: {
              EN: { releasedAt: "2020-01-01", precision: "day" },
              FR: { releasedAt: "2999-01-01", precision: "day" },
            },
            setType: "main",
          },
        ],
        printings: {
          en: printingValue({ language: "EN" }),
          fr: printingValue({ language: "FR" }),
        },
      } as Partial<CatalogResponse>),
    );
    expect(joined.find((p) => p.printingId === "en")?.setReleased).toBe(true);
    expect(joined.find((p) => p.printingId === "fr")?.setReleased).toBe(false);
  });

  it("treats a language with no release entry as unreleased", () => {
    const joined = joinCatalogPrintings(
      catalog({ printings: { de: printingValue({ language: "DE" }) } } as Partial<CatalogResponse>),
    );
    expect(joined[0]!.setReleased).toBe(false);
  });

  it("drops a printing whose set is absent from the payload", () => {
    const joined = joinCatalogPrintings(
      catalog({
        printings: { orphan: printingValue({ setId: "missing-set" }) },
      } as Partial<CatalogResponse>),
    );
    expect(joined).toEqual([]);
  });

  it("drops a printing whose card is absent from the payload", () => {
    const joined = joinCatalogPrintings(
      catalog({
        printings: { orphan: printingValue({ cardId: "missing-card" }) },
      } as Partial<CatalogResponse>),
    );
    expect(joined).toEqual([]);
  });

  it("returns an empty array for a catalog with no printings", () => {
    expect(joinCatalogPrintings(catalog({ printings: {} }))).toEqual([]);
  });

  it("carries the wire value's own fields through untouched", () => {
    const [printing] = joinCatalogPrintings(
      catalog({
        printings: { p: printingValue({ canonicalRank: 42, artist: "Someone Else" }) },
      } as Partial<CatalogResponse>),
    );
    expect(printing!.canonicalRank).toBe(42);
    expect(printing!.artist).toBe("Someone Else");
  });
});

describe("joinCatalog", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const ban = {
    formatId: "standard",
    formatName: "Standard",
    bannedAt: "2026-09-18",
    reason: null,
  };

  it("shows a ban as upcoming until its start day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T23:59:00.000Z"));
    const { printings } = joinCatalog(catalog({ cards: { [CARD_ID]: card({ bans: [ban] }) } }));
    expect(printings[0]!.card.bans).toEqual([]);
    expect(printings[0]!.card.upcomingBans).toEqual([ban]);
  });

  it("counts a ban as in effect from its start day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-18T00:00:00.000Z"));
    const { printings } = joinCatalog(catalog({ cards: { [CARD_ID]: card({ bans: [ban] }) } }));
    expect(printings[0]!.card.bans).toEqual([ban]);
    expect(printings[0]!.card.upcomingBans).toEqual([]);
  });

  it("gives every printing of a card the card object from cardsById", () => {
    const { cardsById, printings } = joinCatalog(
      catalog({ printings: { "printing-1": printingValue(), "printing-2": printingValue() } }),
    );
    expect(printings[0]!.card).toBe(cardsById[CARD_ID]);
    expect(printings[1]!.card).toBe(cardsById[CARD_ID]);
  });
});
