import { describe, expect, it } from "vitest";

import type { BuildCardShareInputArgs } from "./card-share-input.js";
import { buildCardShareInput } from "./card-share-input.js";

const CARD_ID = "card-1";

function printing(overrides: Partial<BuildCardShareInputArgs["printings"][number]> = {}) {
  return {
    printingId: "p-en",
    side: 1,
    cardId: CARD_ID,
    slug: "en-ogn-001-normal-standard",
    setId: "set-ogn",
    publicCode: "OGN-001",
    rarity: "common",
    fallbackImageId: null,
    ...overrides,
  };
}

function args(overrides: Partial<BuildCardShareInputArgs> = {}): BuildCardShareInputArgs {
  return {
    card: {
      id: CARD_ID,
      name: "Blazing Scorcher",
      domains: ["fury"],
      superTypes: [],
      types: ["unit"],
      tags: [],
    },
    printings: [
      printing(),
      printing({ printingId: "p-en-foil", slug: "en-ogn-001-foil-standard" }),
      printing({ printingId: "p-promo", slug: "en-ogn-001-foil-promo-standard" }),
      printing({ printingId: "p-kr", slug: "kr-ogn-001-normal-standard" }),
    ],
    images: [
      { printingId: "p-en", side: 1, imageId: "img-en" },
      { printingId: "p-en-foil", side: 1, imageId: "img-en" },
      { printingId: "p-promo", side: 1, imageId: "img-promo" },
      { printingId: "p-kr", side: 1, imageId: "img-kr" },
    ],
    sets: [{ id: "set-ogn", name: "Origins" }],
    prices: [
      { printingId: "p-en", marketplace: "tcgplayer", marketCents: 24 },
      { printingId: "p-en", marketplace: "cardtrader", marketCents: 18 },
      { printingId: "p-en", marketplace: "cardmarket", marketCents: 99 },
      { printingId: "p-kr", marketplace: "cardtrader", marketCents: 50 },
    ],
    labels: {
      domains: { fury: "Fury" },
      superTypes: {},
      cardTypes: { unit: "Unit" },
      rarities: { common: "Common" },
    },
    ...overrides,
  };
}

describe("buildCardShareInput", () => {
  it("describes the named printing with TCGplayer and CardTrader prices only", () => {
    const input = buildCardShareInput(args({ printingSlug: "en-ogn-001-normal-standard" }));

    expect(input).toMatchObject({
      cardName: "Blazing Scorcher",
      typeLine: "Fury Unit",
      detailLine: "Origins · OGN-001 · Common",
      imageId: "img-en",
      otherImageIds: ["img-promo", "img-kr"],
      printingCount: 4,
      prices: [
        { label: "TCGplayer", value: "$0.24" },
        { label: "CardTrader", value: "€0.18" },
      ],
    });
  });

  it("drops a marketplace with no price for the printing", () => {
    const input = buildCardShareInput(args({ printingSlug: "kr-ogn-001-normal-standard" }));

    expect(input?.imageId).toBe("img-kr");
    expect(input?.prices).toEqual([{ label: "CardTrader", value: "€0.50" }]);
  });

  it("falls back to the first printing without a slug", () => {
    expect(buildCardShareInput(args())?.imageId).toBe("img-en");
  });

  it("returns null for a slug that names no printing of the card", () => {
    expect(buildCardShareInput(args({ printingSlug: "missing" }))).toBeNull();
  });

  it("shows this card's face of a printing where it is the back side", () => {
    const input = buildCardShareInput(
      args({
        printings: [printing({ printingId: "p-tok", side: 2, slug: "en-ogn-t05-normal-standard" })],
        images: [
          { printingId: "p-tok", side: 1, imageId: "img-other-card" },
          { printingId: "p-tok", side: 2, imageId: "img-own-face" },
        ],
        printingSlug: "en-ogn-t05-normal-standard",
      }),
    );

    expect(input?.imageId).toBe("img-own-face");
  });

  it("uses the pinned fallback image when the printing has none", () => {
    const input = buildCardShareInput(
      args({
        printings: [printing({ fallbackImageId: "img-fallback" })],
        images: [],
      }),
    );

    expect(input?.imageId).toBe("img-fallback");
    expect(input?.printingCount).toBe(1);
  });
});
