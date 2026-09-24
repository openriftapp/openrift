import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";
import type { ListDetailResponse, ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import { describe, expect, it } from "vitest";

import {
  buildWantedCards,
  wantedCardKey,
  wantedMatchesPrinting,
  wishDecrements,
} from "./wanted-cards";

const NO_PREF = { pricePref: null, priceAbsoluteCents: null, tradeType: null };

function cardEntry(
  overrides: Partial<Extract<ListEntryDetailResponse, { kind: "card" }>> = {},
): ListEntryDetailResponse {
  return {
    id: "entry-1",
    listId: "list-1",
    quantity: 1,
    tradeOverride: NO_PREF,
    source: "manual",
    ruleQuantity: 0,
    cardName: "Jinx, Rebel",
    kind: "card",
    cardId: "card-1",
    ...overrides,
  };
}

function printingEntry(
  overrides: Partial<Extract<ListEntryDetailResponse, { kind: "printing" }>> = {},
): ListEntryDetailResponse {
  return {
    id: "entry-2",
    listId: "list-1",
    quantity: 1,
    tradeOverride: NO_PREF,
    source: "manual",
    ruleQuantity: 0,
    cardName: "Falling Star",
    kind: "printing",
    printingId: "printing-2",
    setId: "set-1",
    rarity: "rare",
    finish: "normal",
    shortCode: "OGN-029",
    language: "EN",
    imageId: null,
    ...overrides,
  };
}

function wishList(
  id: string,
  name: string,
  entries: ListEntryDetailResponse[],
): ListDetailResponse {
  return { list: { id, name }, entries } as ListDetailResponse;
}

function incomingTrade(overrides: Partial<CardTradeResponse> = {}): CardTradeResponse {
  return {
    id: "trade-1",
    groupId: "group-1",
    groupSlug: "summoner-skirmish",
    groupName: "Summoner Skirmish",
    role: "receiver",
    initiator: "receiver",
    counterparty: {
      userId: "user-2",
      name: "Robin",
      image: null,
      gravatarHash: "h",
      contactMethods: [],
    },
    printingId: "printing-2",
    cardId: "card-2",
    quantity: 1,
    status: "pending",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    acceptedAt: null,
    completedAt: null,
    closedAt: null,
    expiresAt: null,
    viewerSyncAppliedAt: null,
    counterpartySyncAppliedAt: null,
    viewerWishEntryId: null,
    actionNeeded: null,
    ...overrides,
  };
}

const cardOf = (printingId: string) =>
  ({ "printing-2": "card-2", "printing-3": "card-3" })[printingId];

describe("buildWantedCards", () => {
  it("sums one card across lists and remembers where it was wished", () => {
    const wanted = buildWantedCards(
      [
        wishList("list-1", "Wants", [cardEntry({ quantity: 2 })]),
        wishList("list-2", "Jinx Aggro", [cardEntry({ id: "entry-9", listId: "list-2" })]),
      ],
      [],
      cardOf,
    );
    expect(wanted).toEqual([
      {
        key: wantedCardKey("card", "card-1"),
        kind: "card",
        cardId: "card-1",
        printingId: null,
        quantity: 3,
        ruleQuantity: 0,
        listNames: ["Wants", "Jinx Aggro"],
        entries: [
          { listId: "list-1", listName: "Wants", entryId: "entry-1", spare: 2 },
          { listId: "list-2", listName: "Jinx Aggro", entryId: "entry-9", spare: 1 },
        ],
      },
    ]);
  });

  it("keys printing wishes by printing and resolves their card", () => {
    const [wanted] = buildWantedCards([wishList("list-1", "Wants", [printingEntry()])], [], cardOf);
    expect(wanted?.key).toBe("printing:printing-2");
    expect(wanted?.cardId).toBe("card-2");
  });

  it("skips printings the catalog does not know", () => {
    expect(
      buildWantedCards(
        [wishList("list-1", "Wants", [printingEntry({ printingId: "printing-x" })])],
        [],
        cardOf,
      ),
    ).toEqual([]);
  });

  it("counts rule-added copies but only offers the hand-added part for editing", () => {
    const [wanted] = buildWantedCards(
      [
        wishList("list-1", "Wants", [
          cardEntry({ quantity: 3, ruleQuantity: 2, source: "both" }),
          cardEntry({ id: null, quantity: 1, ruleQuantity: 1, source: "rule" }),
        ]),
      ],
      [],
      cardOf,
    );
    expect(wanted?.quantity).toBe(4);
    expect(wanted?.ruleQuantity).toBe(3);
    expect(wanted?.entries).toEqual([
      { listId: "list-1", listName: "Wants", entryId: "entry-1", spare: 1 },
    ]);
  });

  it("nets out copies a live incoming trade already brings", () => {
    const wanted = buildWantedCards(
      [wishList("list-1", "Wants", [printingEntry({ quantity: 2 })])],
      [incomingTrade()],
      cardOf,
    );
    expect(wanted.map((card) => card.quantity)).toEqual([1]);
  });

  it("drops a wish a live trade fully covers", () => {
    expect(
      buildWantedCards([wishList("list-1", "Wants", [printingEntry()])], [incomingTrade()], cardOf),
    ).toEqual([]);
  });

  it("ignores outgoing, finished and already-settled trades", () => {
    const wanted = buildWantedCards(
      [wishList("list-1", "Wants", [printingEntry()])],
      [
        incomingTrade({ role: "giver" }),
        incomingTrade({ status: "completed" }),
        incomingTrade({ status: "reserved", viewerSyncAppliedAt: "2026-08-02T10:00:00.000Z" }),
      ],
      cardOf,
    );
    expect(wanted).toHaveLength(1);
  });

  it("lets one incoming copy cover only one wish when a card and printing wish overlap", () => {
    const wanted = buildWantedCards(
      [
        wishList("list-1", "Wants", [
          cardEntry({ cardId: "card-2" }),
          printingEntry({ id: "entry-3" }),
        ]),
      ],
      [incomingTrade()],
      cardOf,
    );
    expect(wanted.map((card) => [card.key, card.quantity])).toEqual([["card:card-2", 1]]);
  });

  it("keeps a live trade's own wish entry out of reach", () => {
    const [wanted] = buildWantedCards(
      [
        wishList("list-1", "Wants", [printingEntry({ id: "entry-a" })]),
        wishList("list-2", "Deck", [printingEntry({ id: "entry-b", listId: "list-2" })]),
      ],
      [incomingTrade({ viewerWishEntryId: "entry-a" })],
      cardOf,
    );
    expect(wanted?.quantity).toBe(1);
    expect(wanted?.entries.map((entry) => entry.entryId)).toEqual(["entry-b"]);
  });

  it("drops rule-added wants that ordered copies cover", () => {
    expect(
      buildWantedCards(
        [
          wishList("list-1", "Deck gaps", [
            printingEntry({ id: null, source: "rule", ruleQuantity: 1 }),
          ]),
        ],
        [],
        cardOf,
        [{ printingId: "printing-2", cardId: "card-2" }],
      ),
    ).toEqual([]);
  });

  it("leaves hand-added wants to the wish list update, not the ordered copies", () => {
    const wanted = buildWantedCards([wishList("list-1", "Wants", [printingEntry()])], [], cardOf, [
      { printingId: "printing-2", cardId: "card-2" },
    ]);
    expect(wanted.map((card) => card.quantity)).toEqual([1]);
  });

  it("nets card wishes against any printing of the card", () => {
    expect(
      buildWantedCards(
        [wishList("list-1", "Wants", [cardEntry({ cardId: "card-2" })])],
        [incomingTrade({ printingId: "printing-3", cardId: "card-2" })],
        cardOf,
      ),
    ).toEqual([]);
  });
});

describe("wantedMatchesPrinting", () => {
  it("matches any printing for a card wish", () => {
    expect(
      wantedMatchesPrinting({ kind: "card", cardId: "card-1", printingId: null }, "card-1", "p-9"),
    ).toBe(true);
  });

  it("matches only the exact printing for a printing wish", () => {
    const wish = { kind: "printing" as const, cardId: "card-1", printingId: "p-1" };
    expect(wantedMatchesPrinting(wish, "card-1", "p-1")).toBe(true);
    expect(wantedMatchesPrinting(wish, "card-1", "p-2")).toBe(false);
  });
});

describe("wishDecrements", () => {
  const entries = [
    { listId: "list-1", listName: "Wants", entryId: "entry-1", spare: 2 },
    { listId: "list-2", listName: "Jinx Aggro", entryId: "entry-2", spare: 3 },
  ];

  it("lowers the first entry when it covers the received copies", () => {
    expect(wishDecrements(entries, 1)).toEqual([{ entryId: "entry-1", by: 1 }]);
  });

  it("spends each entry's spare copies in order", () => {
    expect(wishDecrements(entries, 3)).toEqual([
      { entryId: "entry-1", by: 2 },
      { entryId: "entry-2", by: 1 },
    ]);
  });

  it("stops at the spare total", () => {
    expect(wishDecrements(entries, 9).map((decrement) => decrement.by)).toEqual([2, 3]);
  });
});
