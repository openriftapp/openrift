import { describe, expect, it } from "vitest";

import { META_MAX_PLAYERS } from "../meta-query.js";
import { POSTGRES_INTEGER_MAX, POSTGRES_SMALLINT_MAX } from "../schemas.js";
import { ignoreProductsInput } from "./admin/ignored-products.js";
import { cardTradeSyncSchema, createCardTradeSchema } from "./card-trades.js";
import { updateCollectionSchema } from "./collections.js";
import { MAX_DECK_CARD_ROWS } from "./decks.js";
import { createLoanSchema, returnLoanCopiesSchema } from "./loans.js";
import { metaSubmissionInputSchema } from "./meta-submissions.js";
import { metaDeckQuerySchema, metaEventFilterQuerySchema } from "./meta.js";
import { encodeDeckInputSchema } from "./public-decks.js";
import {
  generateRoundSchema,
  replacePairingSchema,
  roundNumberParamSchema,
} from "./tournaments.js";

const UUID = "019cfc3b-03d3-7dac-86c9-27900cd43727";

describe("encodeDeckInputSchema", () => {
  const card = {
    cardId: UUID,
    zone: "main",
    quantity: 3,
    preferredPrintingId: null,
    cardName: "Ahri",
    cardType: "Unit",
    superTypes: [],
    domains: [],
  };

  it("accepts a normal deck", () => {
    expect(encodeDeckInputSchema.safeParse({ cards: [card] }).success).toBe(true);
    expect(
      encodeDeckInputSchema.safeParse({ cards: [{ ...card, preferredPrintingId: UUID }] }).success,
    ).toBe(true);
  });

  it("rejects ids that are not uuids", () => {
    expect(encodeDeckInputSchema.safeParse({ cards: [{ ...card, cardId: "x" }] }).success).toBe(
      false,
    );
    expect(
      encodeDeckInputSchema.safeParse({ cards: [{ ...card, preferredPrintingId: "x" }] }).success,
    ).toBe(false);
  });

  it("takes as many rows as a saved deck holds, and caps the quantity", () => {
    const rows = Array.from({ length: MAX_DECK_CARD_ROWS }, () => card);
    expect(encodeDeckInputSchema.safeParse({ cards: rows }).success).toBe(true);
    expect(encodeDeckInputSchema.safeParse({ cards: [...rows, card] }).success).toBe(false);
    expect(
      encodeDeckInputSchema.safeParse({
        cards: [{ ...card, quantity: POSTGRES_INTEGER_MAX + 1 }],
      }).success,
    ).toBe(false);
  });
});

describe("meta filter bounds", () => {
  it("accepts player counts and ranks within the cap", () => {
    expect(
      metaEventFilterQuerySchema.safeParse({ playersMin: "8", playersMax: "512" }).success,
    ).toBe(true);
    expect(metaDeckQuerySchema.safeParse({ maxRank: "8" }).success).toBe(true);
  });

  it("rejects values above the cap", () => {
    const over = String(META_MAX_PLAYERS + 1);
    expect(metaEventFilterQuerySchema.safeParse({ playersMin: over }).success).toBe(false);
    expect(metaEventFilterQuerySchema.safeParse({ playersMax: over }).success).toBe(false);
    expect(metaDeckQuerySchema.safeParse({ maxRank: over }).success).toBe(false);
  });
});

describe("metaSubmissionInputSchema", () => {
  const base = {
    metaEventId: UUID,
    playerName: "Ahri Main",
    rank: 1,
    cards: [{ name: "Ahri", zone: "main", quantity: 3 }],
  };

  it("accepts a normal result", () => {
    expect(
      metaSubmissionInputSchema.safeParse({ ...base, wins: 7, losses: 1, draws: 0 }).success,
    ).toBe(true);
  });

  it("rejects values the columns cannot hold", () => {
    expect(
      metaSubmissionInputSchema.safeParse({ ...base, rank: META_MAX_PLAYERS + 1 }).success,
    ).toBe(false);
    for (const key of ["wins", "losses", "draws"]) {
      expect(
        metaSubmissionInputSchema.safeParse({ ...base, [key]: POSTGRES_SMALLINT_MAX + 1 }).success,
      ).toBe(false);
      expect(
        metaSubmissionInputSchema.safeParse({ ...base, [key]: POSTGRES_SMALLINT_MAX }).success,
      ).toBe(true);
    }
  });

  it("caps a proposed event's player count", () => {
    const { metaEventId: _omit, ...rest } = base;
    const proposed = (playerCount: number) => ({
      ...rest,
      proposedEvent: {
        name: "Summoner Skirmish",
        eventDate: "2026-06-01",
        format: "constructed",
        playerCount,
      },
    });
    expect(metaSubmissionInputSchema.safeParse(proposed(64)).success).toBe(true);
    expect(metaSubmissionInputSchema.safeParse(proposed(META_MAX_PLAYERS + 1)).success).toBe(false);
  });
});

describe("updateCollectionSchema", () => {
  it("bounds sortOrder to the integer column", () => {
    expect(updateCollectionSchema.safeParse({ sortOrder: 3 }).success).toBe(true);
    expect(updateCollectionSchema.safeParse({ sortOrder: POSTGRES_INTEGER_MAX + 1 }).success).toBe(
      false,
    );
    expect(updateCollectionSchema.safeParse({ sortOrder: -POSTGRES_INTEGER_MAX - 2 }).success).toBe(
      false,
    );
  });
});

describe("ignoreProductsInput", () => {
  it("accepts a marketplace product id", () => {
    expect(
      ignoreProductsInput.safeParse({
        level: "product",
        marketplace: "tcgplayer",
        products: [{ externalId: 123_456 }],
      }).success,
    ).toBe(true);
  });

  it.each([1.5, 0, POSTGRES_INTEGER_MAX + 1])("rejects externalId %s", (externalId) => {
    expect(
      ignoreProductsInput.safeParse({
        level: "product",
        marketplace: "tcgplayer",
        products: [{ externalId }],
      }).success,
    ).toBe(false);
    expect(
      ignoreProductsInput.safeParse({
        level: "variant",
        marketplace: "tcgplayer",
        products: [{ externalId, finish: "normal", language: null }],
      }).success,
    ).toBe(false);
  });
});

describe("quantity bounds", () => {
  it("accepts a normal quantity and rejects one above the column", () => {
    const over = POSTGRES_INTEGER_MAX + 1;
    expect(returnLoanCopiesSchema.safeParse({ quantity: 2 }).success).toBe(true);
    expect(returnLoanCopiesSchema.safeParse({ quantity: over }).success).toBe(false);
    expect(
      createLoanSchema.safeParse({ printingId: UUID, quantity: over, borrowerName: "Jinx" })
        .success,
    ).toBe(false);
    expect(
      createCardTradeSchema.safeParse({
        groupSlug: "summoners",
        counterpartyUserId: "u1",
        role: "giver",
        printingId: UUID,
        quantity: over,
      }).success,
    ).toBe(false);
    expect(cardTradeSyncSchema.safeParse({ requestId: UUID, quantity: over }).success).toBe(false);
    expect(cardTradeSyncSchema.safeParse({ requestId: UUID, quantity: 2 }).success).toBe(true);
  });
});

describe("tournament round inputs", () => {
  it("bounds the round number", () => {
    expect(roundNumberParamSchema.safeParse({ id: UUID, roundNumber: "3" }).success).toBe(true);
    expect(
      roundNumberParamSchema.safeParse({ id: UUID, roundNumber: String(POSTGRES_INTEGER_MAX + 1) })
        .success,
    ).toBe(false);
  });

  it("caps the byes and pods", () => {
    const ids = (n: number) => Array.from({ length: n }, () => UUID);
    expect(generateRoundSchema.safeParse({ byes: ids(2) }).success).toBe(true);
    expect(generateRoundSchema.safeParse({ byes: ids(1025) }).success).toBe(false);
    const pod = { size: 2, playerIds: ids(2) };
    const pods = Array.from({ length: 1025 }, () => pod);
    expect(replacePairingSchema.safeParse({ pods: [pod], byes: [] }).success).toBe(true);
    expect(replacePairingSchema.safeParse({ pods, byes: [] }).success).toBe(false);
    expect(replacePairingSchema.safeParse({ pods: [pod], byes: ids(1025) }).success).toBe(false);
  });
});
