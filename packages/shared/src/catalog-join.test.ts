import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogRefResolver, joinCatalog, joinCatalogPrintings } from "./catalog-join";
import { makeCatalogReference } from "./test-factories.js";
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
    ...makeCatalogReference(),
    ...overrides,
  } as CatalogResponse;
}

const GOLD_ID = "00000000-0000-0000-0000-000000000002";

describe("joinCatalog foil twins", () => {
  it("derives hasFoilTwin from the joined printings", () => {
    const { printings } = joinCatalog(
      catalog({
        printings: {
          "printing-normal": printingValue(),
          "printing-foil": printingValue({ finish: "foil" }),
        },
      }),
    );
    expect(printings.map((p) => [p.printingId, p.hasFoilTwin])).toEqual([
      ["printing-normal", true],
      ["printing-foil", undefined],
    ]);
  });
});

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

const PROMO = { id: "m-1", slug: "promo", label: "Promo", description: null };

function channelDef(id: string, slug: string, label: string, parentId: string | null) {
  return {
    id,
    slug,
    label,
    description: null,
    kind: "event" as const,
    parentId,
    childrenLabel: null,
  };
}

const ROOT = channelDef("ch-root", "events", "Events", null);
const MID = channelDef("ch-mid", "nexus-night", "Nexus Night", "ch-root");
const LEAF = channelDef("ch-leaf", "top-8", "Top 8", "ch-mid");

describe("catalogRefResolver", () => {
  const resolve = catalogRefResolver({ markers: [PROMO], distributionChannels: [ROOT, MID, LEAF] });

  it("resolves marker slugs in order and drops unknown ones", () => {
    expect(resolve.markers(["promo", "retired"])).toEqual([PROMO]);
  });

  it("resolves a channel with its note and ancestor labels, root first", () => {
    expect(resolve.channels([{ channel: "top-8", note: "Season 1" }])).toEqual([
      { channel: LEAF, distributionNote: "Season 1", ancestorLabels: ["Events", "Nexus Night"] },
    ]);
  });

  it("gives a channel without a note a null note and a root no ancestors", () => {
    expect(resolve.channels([{ channel: "events" }])).toEqual([
      { channel: ROOT, distributionNote: null, ancestorLabels: [] },
    ]);
  });

  it("drops a reference to an unknown channel", () => {
    expect(resolve.channels([{ channel: "gone" }])).toEqual([]);
  });

  it("stops walking a parent cycle", () => {
    const a = channelDef("a", "a", "A", "b");
    const b = channelDef("b", "b", "B", "a");
    const cyclic = catalogRefResolver({ markers: [], distributionChannels: [a, b] });
    expect(cyclic.channels([{ channel: "a" }])[0]?.ancestorLabels).toHaveLength(32);
  });
});

describe("joinCatalog references", () => {
  it("joins printings with resolved markers and channels", () => {
    const { printings } = joinCatalog(
      catalog({
        printings: {
          "printing-1": printingValue({
            markers: ["promo"],
            distributionChannels: [{ channel: "nexus-night", note: "Top 8" }],
          }),
        },
        ...makeCatalogReference({ markers: [PROMO], distributionChannels: [ROOT, MID] }),
      }),
    );
    expect(printings[0]?.markers).toEqual([PROMO]);
    expect(printings[0]?.distributionChannels).toEqual([
      { channel: MID, distributionNote: "Top 8", ancestorLabels: ["Events"] },
    ]);
  });
});
