import type { FriendGroupMatchRow } from "@openrift/shared/types/api/friend-group";
import { describe, expect, it } from "vitest";

import { stubCardTrade } from "@/test/factories";

import { countTradeSuggestions, withoutLiveTradeMatches } from "./trade-derivation";
import { dismissalKeys } from "./trade-dismissals";
import { finderPeople } from "./trade-finder";
import type { TradeMarketGroup } from "./trade-market";
import {
  buildTradeMarket,
  filterMarketByGroup,
  filterMarketByPerson,
  marketDismissals,
  openMarketCards,
  sortByValue,
  wantedSources,
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

describe("buildTradeMarket", () => {
  it("pools one printing's copies from several people and groups into one card", () => {
    const market = buildTradeMarket([
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
    ]);
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
    const market = buildTradeMarket([
      stubGroup({ incoming: [stubRow(), stubRow({ printingId: "printing-2" })] }),
    ]);
    expect(market.incoming.map((card) => card.printingId)).toEqual(["printing-1", "printing-2"]);
  });

  it("gives a double-sided printing a card per side it was matched for", () => {
    const market = buildTradeMarket([
      stubGroup({
        incoming: [
          stubRow({ printingId: "pair", cardId: "bird" }),
          stubRow({ printingId: "pair", cardId: "gold", copyId: "copy-2" }),
        ],
      }),
    ]);
    expect(market.incoming.map((card) => card.cardId)).toEqual(["bird", "gold"]);
  });

  it("keeps a person's row on the card whatever trade they already have going", () => {
    const market = buildTradeMarket([stubGroup({ incoming: [stubRow()] })]);
    expect(filterMarketByPerson(market.incoming, "user-2")).toHaveLength(1);
    expect(market.incoming[0]?.sources.map((source) => source.userId)).toEqual(["user-2"]);
  });
});

describe("openMarketCards", () => {
  it("drops a card held only by a live trade", () => {
    const market = buildTradeMarket([
      stubGroup({ incoming: [{ ...stubRow(), liveOnly: true }], outgoing: [stubRow()] }),
    ]);
    expect(market.incoming).toHaveLength(1);
    expect(openMarketCards(market.incoming, [])).toEqual([]);
    expect(openMarketCards(market.outgoing, [])).toHaveLength(1);
  });

  it("keeps one card offered by three members as one card", () => {
    const market = buildTradeMarket([
      stubGroup({
        incoming: [
          stubRow(),
          stubRow({ counterpartyUserId: "user-3", buyEntryId: "buy-2" }),
          stubRow({ counterpartyUserId: "user-4", buyEntryId: "buy-3" }),
        ],
      }),
    ]);
    expect(openMarketCards(market.incoming, [])).toHaveLength(1);
  });

  it("drops a card whose only row is in a live trade", () => {
    const market = buildTradeMarket([stubGroup({ incoming: [stubRow()] })]);
    const live = [stubCardTrade({ role: "receiver", status: "pending" })];
    expect(market.incoming).toHaveLength(1);
    expect(openMarketCards(market.incoming, live)).toEqual([]);
  });

  it("keeps a card that is in a trade in the other direction only", () => {
    const market = buildTradeMarket([stubGroup({ incoming: [stubRow()] })]);
    const live = [stubCardTrade({ role: "giver", status: "pending" })];
    expect(openMarketCards(market.incoming, live)).toHaveLength(1);
  });

  it("keeps only the free rows and sources of a partly traded card", () => {
    const market = buildTradeMarket([
      stubGroup({
        incoming: [stubRow(), stubRow({ counterpartyUserId: "user-3", buyEntryId: "buy-2" })],
      }),
    ]);
    const live = [stubCardTrade({ role: "receiver", status: "pending" })];
    const [card, ...rest] = openMarketCards(market.incoming, live);
    expect(rest).toEqual([]);
    expect(card?.rows.map((row) => row.counterpartyUserId)).toEqual(["user-3"]);
    expect(card?.sources.map((source) => source.userId)).toEqual(["user-3"]);
  });

  it("counts people and dismissals from the same open cards", () => {
    const market = buildTradeMarket([
      stubGroup({
        incoming: [
          stubRow(),
          stubRow({ printingId: "printing-2", cardId: "card-2", buyEntryId: "buy-2" }),
          stubRow({ counterpartyUserId: "user-3", buyEntryId: "buy-3" }),
        ],
      }),
    ]);
    const live = [stubCardTrade({ role: "receiver", status: "pending" })];
    const open = openMarketCards(market.incoming, live);
    expect(open).toHaveLength(2);
    expect(
      finderPeople(open, [])
        .map((person) => [person.userId, person.get.length])
        .toSorted(([a], [b]) => String(a).localeCompare(String(b))),
    ).toEqual([
      ["user-2", 1],
      ["user-3", 1],
    ]);
    expect(marketDismissals(open, "user-2")).toEqual([
      { direction: "incoming", counterpartyUserId: "user-2", printingId: "printing-2" },
    ]);
  });

  it("never exceeds the hub's suggestion count for the same data", () => {
    const rows = [
      stubRow(),
      stubRow({ counterpartyUserId: "user-3", buyEntryId: "buy-2" }),
      stubRow({ printingId: "printing-2", cardId: "card-2", buyEntryId: "buy-3" }),
      stubRow({ printingId: "printing-3", cardId: "card-3", buyEntryId: "buy-4" }),
    ];
    const trades = [
      stubCardTrade({ role: "receiver", printingId: "printing-3", cardId: "card-3" }),
    ];
    const market = buildTradeMarket([stubGroup({ incoming: rows })]);
    const hubSuggestions = countTradeSuggestions(
      withoutLiveTradeMatches(rows, trades, "incoming"),
      [],
    );
    expect(openMarketCards(market.incoming, trades)).toHaveLength(2);
    expect(hubSuggestions).toBe(3);
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
      dismissalKeys([
        { direction: "outgoing", counterpartyUserId: "user-2", printingId: "printing-1" },
      ]),
    );
    expect(market.outgoing[0]?.sources.map((source) => source.userId)).toEqual(["user-3"]);
  });

  it("only hides the dismissed direction", () => {
    const market = buildTradeMarket(
      [stubGroup({ incoming: [stubRow()] })],
      dismissalKeys([
        { direction: "outgoing", counterpartyUserId: "user-2", printingId: "printing-1" },
      ]),
    );
    expect(market.incoming).toHaveLength(1);
  });
});

describe("people", () => {
  const market = buildTradeMarket([
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
  ]);

  it("narrows cards to one person", () => {
    expect(filterMarketByPerson(market.incoming, "user-3")).toEqual([]);
    expect(filterMarketByPerson(market.outgoing, "user-3")).toHaveLength(1);
    expect(filterMarketByPerson(market.incoming, null)).toHaveLength(2);
  });

  it("builds a dismissal for each of one person's suggestions", () => {
    expect(marketDismissals([...market.incoming, ...market.outgoing], "user-2")).toEqual([
      { direction: "incoming", counterpartyUserId: "user-2", printingId: "printing-1" },
      { direction: "incoming", counterpartyUserId: "user-2", printingId: "printing-2" },
    ]);
  });
});

describe("filterMarketByGroup", () => {
  const market = buildTradeMarket([
    stubGroup({ incoming: [stubRow()], outgoing: [stubRow({ printingId: "printing-9" })] }),
    stubGroup({
      slug: "piltover-league",
      name: "Piltover League",
      incoming: [stubRow({ counterpartyUserId: "user-3" })],
    }),
  ]);

  it("returns every card for no group", () => {
    expect(filterMarketByGroup(market.incoming, null)).toHaveLength(1);
  });

  it("narrows rows and sources to one group", () => {
    const [card] = filterMarketByGroup(market.incoming, "piltover-league");
    expect(card?.rows).toHaveLength(1);
    expect(card?.sources.map((source) => source.userId)).toEqual(["user-3"]);
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

describe("wantedSources", () => {
  const market = buildTradeMarket([
    stubGroup({
      incoming: [
        stubRow(),
        stubRow({ printingId: "printing-2", copyId: "copy-2" }),
        stubRow({
          counterpartyUserId: "user-3",
          counterpartyName: "Kai",
          printingId: "printing-2",
          copyId: "copy-3",
        }),
        stubRow({ cardId: "card-2", printingId: "printing-3", copyId: "copy-4" }),
      ],
    }),
  ]);

  it("collects each person once across every printing of a card wish", () => {
    expect(
      wantedSources({ kind: "card", cardId: "card-1", printingId: null }, market.incoming).map(
        (source) => source.name,
      ),
    ).toEqual(["Robin", "Kai"]);
  });

  it("only counts the exact printing for a printing wish", () => {
    expect(
      wantedSources(
        { kind: "printing", cardId: "card-1", printingId: "printing-1" },
        market.incoming,
      ).map((source) => source.name),
    ).toEqual(["Robin"]);
  });

  it("returns no one when nobody has the card", () => {
    expect(
      wantedSources({ kind: "card", cardId: "card-9", printingId: null }, market.incoming),
    ).toEqual([]);
  });
});
