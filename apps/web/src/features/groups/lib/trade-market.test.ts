import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";
import type { FriendGroupMatchRow } from "@openrift/shared/types/api/friend-group";
import { describe, expect, it } from "vitest";

import { dismissalKeys } from "./trade-dismissals";
import type { TradeMarketGroup } from "./trade-market";
import {
  buildTradeMarket,
  filterMarketByGroup,
  filterMarketByPerson,
  marketDismissals,
  marketPeople,
  sortByValue,
} from "./trade-market";

function stubRow(overrides: Partial<FriendGroupMatchRow> = {}): FriendGroupMatchRow {
  return {
    counterpartyUserId: "user-2",
    counterpartyName: "Robin",
    counterpartyImage: null,
    counterpartyGravatarHash: "hash",
    counterpartyListId: "list-1",
    counterpartyListName: "Spares",
    viewerListName: "Wants",
    sellEntryId: "sell-1",
    sellListId: "list-1",
    copyId: "copy-1",
    condition: null,
    grader: null,
    grade: null,
    notesPublic: null,
    printingId: "printing-1",
    cardId: "card-1",
    cardName: "Fury Rune",
    setId: "set-1",
    rarity: "common",
    finish: "normal",
    imageId: null,
    buyEntryId: "buy-1",
    buyListId: "list-2",
    buyEntryKind: "printing",
    buyQuantity: 1,
    sellPref: { pricePref: null, priceAbsoluteCents: null, tradeType: null, currency: null },
    buyPref: { pricePref: null, priceAbsoluteCents: null, tradeType: null, currency: null },
    ...overrides,
  };
}

function stubGroup(overrides: Partial<TradeMarketGroup> = {}): TradeMarketGroup {
  return {
    slug: "summoner-skirmish",
    name: "Summoner Skirmish",
    incoming: [],
    outgoing: [],
    ...overrides,
  };
}

function stubLiveTrade(overrides: Partial<CardTradeResponse> = {}): CardTradeResponse {
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
      gravatarHash: "hash",
      contactMethods: [],
    },
    printingId: "printing-1",
    cardId: "card-1",
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

describe("buildTradeMarket", () => {
  it("pools one printing's copies from several people and groups into one card", () => {
    const market = buildTradeMarket(
      [
        stubGroup({
          incoming: [
            stubRow({ copyId: "copy-1" }),
            stubRow({ copyId: "copy-2", counterpartyUserId: "user-3", counterpartyName: "Kai" }),
          ],
        }),
        stubGroup({
          slug: "piltover-league",
          name: "Piltover League",
          incoming: [stubRow({ copyId: "copy-3" })],
        }),
      ],
      [],
    );
    expect(market.incoming).toHaveLength(1);
    const [card] = market.incoming;
    expect(card?.rows.map((row) => row.groupSlug)).toEqual([
      "summoner-skirmish",
      "summoner-skirmish",
      "piltover-league",
    ]);
    expect(card?.sources.map((source) => [source.userId, source.groupNames])).toEqual([
      ["user-2", ["Summoner Skirmish", "Piltover League"]],
      ["user-3", ["Summoner Skirmish"]],
    ]);
  });

  it("keeps printings of the same card apart", () => {
    const market = buildTradeMarket(
      [stubGroup({ incoming: [stubRow(), stubRow({ printingId: "printing-2" })] })],
      [],
    );
    expect(market.incoming.map((card) => card.printingId)).toEqual(["printing-1", "printing-2"]);
  });

  it("marks sources who also want something from the viewer as swap partners", () => {
    const market = buildTradeMarket(
      [
        stubGroup({
          incoming: [stubRow(), stubRow({ counterpartyUserId: "user-3" })],
          outgoing: [stubRow({ printingId: "printing-9", cardId: "card-9" })],
        }),
      ],
      [],
    );
    expect(market.incoming[0]?.swapUserIds).toEqual(["user-2"]);
    expect(market.outgoing[0]?.swapUserIds).toEqual(["user-2"]);
  });

  it("drops rows a live trade already covers", () => {
    const market = buildTradeMarket([stubGroup({ incoming: [stubRow()] })], [stubLiveTrade()]);
    expect(market.incoming).toEqual([]);
  });

  it("keeps rows whose trade with that person is already finished", () => {
    const market = buildTradeMarket(
      [stubGroup({ incoming: [stubRow()] })],
      [stubLiveTrade({ status: "completed" })],
    );
    expect(market.incoming).toHaveLength(1);
  });
});

describe("dismissed suggestions", () => {
  it("leaves out a dismissed suggestion but keeps the same card from someone else", () => {
    const market = buildTradeMarket(
      [
        stubGroup({
          outgoing: [stubRow(), stubRow({ counterpartyUserId: "user-3", counterpartyName: "Kai" })],
        }),
      ],
      [],
      dismissalKeys([
        { direction: "outgoing", counterpartyUserId: "user-2", printingId: "printing-1" },
      ]),
    );
    expect(market.outgoing[0]?.sources.map((source) => source.userId)).toEqual(["user-3"]);
  });

  it("only hides the dismissed direction", () => {
    const market = buildTradeMarket(
      [stubGroup({ incoming: [stubRow()] })],
      [],
      dismissalKeys([
        { direction: "outgoing", counterpartyUserId: "user-2", printingId: "printing-1" },
      ]),
    );
    expect(market.incoming).toHaveLength(1);
  });
});

describe("people", () => {
  const market = buildTradeMarket(
    [
      stubGroup({
        incoming: [stubRow(), stubRow({ printingId: "printing-2" })],
        outgoing: [
          stubRow({
            printingId: "printing-3",
            counterpartyUserId: "user-3",
            counterpartyName: "Kai",
          }),
        ],
      }),
    ],
    [],
  );

  it("lists everyone on either side, most cards first", () => {
    expect(marketPeople(market).map((person) => [person.userId, person.cardCount])).toEqual([
      ["user-2", 2],
      ["user-3", 1],
    ]);
  });

  it("narrows cards to one person", () => {
    expect(filterMarketByPerson(market.incoming, "user-3")).toEqual([]);
    expect(filterMarketByPerson(market.outgoing, "user-3")).toHaveLength(1);
    expect(filterMarketByPerson(market.incoming, null)).toHaveLength(2);
  });

  it("builds a dismissal for each of one person's suggestions", () => {
    expect(marketDismissals(market, "user-2")).toEqual([
      { direction: "incoming", counterpartyUserId: "user-2", printingId: "printing-1" },
      { direction: "incoming", counterpartyUserId: "user-2", printingId: "printing-2" },
    ]);
  });
});

describe("filterMarketByGroup", () => {
  const market = buildTradeMarket(
    [
      stubGroup({ incoming: [stubRow()], outgoing: [stubRow({ printingId: "printing-9" })] }),
      stubGroup({
        slug: "piltover-league",
        name: "Piltover League",
        incoming: [stubRow({ counterpartyUserId: "user-3" })],
      }),
    ],
    [],
  );

  it("returns every card for no group", () => {
    expect(filterMarketByGroup(market.incoming, null)).toHaveLength(1);
  });

  it("narrows rows, sources and swap partners to one group", () => {
    const [card] = filterMarketByGroup(market.incoming, "piltover-league");
    expect(card?.rows).toHaveLength(1);
    expect(card?.sources.map((source) => source.userId)).toEqual(["user-3"]);
    expect(card?.swapUserIds).toEqual([]);
  });

  it("drops cards the group has no rows for", () => {
    expect(filterMarketByGroup(market.outgoing, "piltover-league")).toEqual([]);
  });
});

describe("sortByValue", () => {
  it("orders by value, puts unpriced items last and breaks ties by name", () => {
    const items = [
      { name: "Annie", value: undefined },
      { name: "Viktor", value: 2 },
      { name: "Jinx", value: 9 },
      { name: "Ahri", value: 2 },
      { name: "Sett", value: undefined },
    ];
    expect(
      sortByValue(
        items,
        (item) => item.value,
        (item) => item.name,
      ).map((item) => item.name),
    ).toEqual(["Jinx", "Ahri", "Viktor", "Annie", "Sett"]);
  });
});
