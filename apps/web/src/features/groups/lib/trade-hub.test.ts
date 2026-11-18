import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";
import { describe, expect, it } from "vitest";

import type { MatchSuggestionFields } from "./trade-derivation";
import {
  buildTradeShelf,
  expiringSoonCount,
  needsYouCounts,
  needsYouLine,
  nextMoveLabel,
  sortNeedsYou,
} from "./trade-hub";

function stubTrade(overrides: Partial<CardTradeResponse> = {}): CardTradeResponse {
  return {
    id: "trade-1",
    groupId: "group-1",
    groupSlug: "summoner-skirmish",
    groupName: "The Group",
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
    autoAccepted: false,
    recipientSeenAt: null,
    actionNeeded: null,
    ...overrides,
  };
}

function stubMatch(overrides: Partial<MatchSuggestionFields> = {}): MatchSuggestionFields {
  return {
    buyEntryKind: "printing",
    buyEntryId: "entry-1",
    cardId: "card-1",
    counterpartyUserId: "user-2",
    counterpartyListId: "list-1",
    printingId: "printing-1",
    ...overrides,
  };
}

function ids(trades: CardTradeResponse[]): string[] {
  return trades.map((trade) => trade.id);
}

describe("needsYouCounts", () => {
  it("counts the three acts apart: answer, hand over, receive", () => {
    expect(
      needsYouCounts([
        stubTrade({ actionNeeded: "accept-or-decline" }),
        stubTrade({ actionNeeded: "accept-or-decline" }),
        stubTrade({ actionNeeded: "settle", role: "giver" }),
        stubTrade({ actionNeeded: "settle", role: "receiver" }),
        stubTrade({ actionNeeded: "settle", role: "receiver" }),
      ]),
    ).toEqual({ toAnswer: 2, toHandOver: 1, toReceive: 2 });
  });

  it("ignores anything that isn't waiting on the viewer", () => {
    expect(
      needsYouCounts([stubTrade({ actionNeeded: "cancel" }), stubTrade({ actionNeeded: null })]),
    ).toEqual({ toAnswer: 0, toHandOver: 0, toReceive: 0 });
  });

  it("counts nothing for no trades", () => {
    expect(needsYouCounts([])).toEqual({ toAnswer: 0, toHandOver: 0, toReceive: 0 });
  });
});

describe("needsYouLine", () => {
  const NOW = new Date("2026-08-01T12:00:00.000Z");

  it("returns null when nothing needs the viewer", () => {
    expect(needsYouLine([], NOW)).toBeNull();
  });

  it("lists each stage in order, then the expiry warning", () => {
    const rows = [
      stubTrade({
        id: "a",
        actionNeeded: "accept-or-decline",
        expiresAt: "2026-08-02T12:00:00.000Z",
      }),
      stubTrade({ id: "b", actionNeeded: "settle", role: "giver" }),
      stubTrade({ id: "c", actionNeeded: "settle", role: "receiver" }),
      stubTrade({ id: "d", actionNeeded: "settle", role: "receiver" }),
    ];
    expect(needsYouLine(rows, NOW)).toBe(
      "1 to answer, 1 to hand over, 2 to confirm · 1 expires soon",
    );
  });

  it("omits the expiry warning for open-ended requests", () => {
    expect(needsYouLine([stubTrade({ actionNeeded: "accept-or-decline" })], NOW)).toBe(
      "1 to answer",
    );
  });
});

describe("nextMoveLabel", () => {
  it("asks to answer a pending request", () => {
    expect(nextMoveLabel(stubTrade({ actionNeeded: "accept-or-decline" }))).toBe("Answer");
  });

  it("asks the giver to hand over and the receiver to confirm when settling", () => {
    expect(nextMoveLabel(stubTrade({ actionNeeded: "settle", role: "giver" }))).toBe("Hand over");
    expect(nextMoveLabel(stubTrade({ actionNeeded: "settle", role: "receiver" }))).toBe("Confirm");
  });

  it("falls back to opening the sheet", () => {
    expect(nextMoveLabel(stubTrade({ actionNeeded: "cancel" }))).toBe("Open");
    expect(nextMoveLabel(undefined)).toBe("Open");
  });
});

describe("expiringSoonCount", () => {
  const NOW = new Date("2026-08-01T12:00:00.000Z");

  function request(expiresAt: string | null): CardTradeResponse {
    return stubTrade({ actionNeeded: "accept-or-decline", expiresAt });
  }

  it("counts the requests running out inside the window", () => {
    const rows = [
      request("2026-08-02T12:00:00.000Z"),
      request("2026-08-03T11:00:00.000Z"),
      request("2026-08-05T12:00:00.000Z"),
    ];
    expect(expiringSoonCount(rows, NOW)).toBe(2);
  });

  it("counts a deadline that has already passed", () => {
    expect(expiringSoonCount([request("2026-07-30T12:00:00.000Z")], NOW)).toBe(1);
  });

  it("skips open-ended requests and every swap awaiting a settle", () => {
    const rows = [
      request(null),
      stubTrade({ actionNeeded: "settle", expiresAt: "2026-08-01T13:00:00.000Z" }),
    ];
    expect(expiringSoonCount(rows, NOW)).toBe(0);
  });
});

describe("sortNeedsYou", () => {
  it("leads with the requests, soonest deadline first", () => {
    const sorted = sortNeedsYou([
      stubTrade({
        id: "later",
        actionNeeded: "accept-or-decline",
        expiresAt: "2026-08-09T10:00:00.000Z",
      }),
      stubTrade({
        id: "sooner",
        actionNeeded: "accept-or-decline",
        expiresAt: "2026-08-03T10:00:00.000Z",
      }),
    ]);
    expect(ids(sorted)).toEqual(["sooner", "later"]);
  });

  it("puts a request with no deadline behind the ones that expire", () => {
    const sorted = sortNeedsYou([
      stubTrade({ id: "open-ended", actionNeeded: "accept-or-decline", expiresAt: null }),
      stubTrade({
        id: "expiring",
        actionNeeded: "accept-or-decline",
        expiresAt: "2026-08-20T10:00:00.000Z",
      }),
    ]);
    expect(ids(sorted)).toEqual(["expiring", "open-ended"]);
  });

  it("puts every settle behind every request, newest settle first", () => {
    const sorted = sortNeedsYou([
      stubTrade({
        id: "old-settle",
        actionNeeded: "settle",
        updatedAt: "2026-08-01T10:00:00.000Z",
      }),
      stubTrade({
        id: "new-settle",
        actionNeeded: "settle",
        updatedAt: "2026-08-05T10:00:00.000Z",
      }),
      stubTrade({ id: "request", actionNeeded: "accept-or-decline", expiresAt: null }),
    ]);
    expect(ids(sorted)).toEqual(["request", "new-settle", "old-settle"]);
  });

  it("leaves the input untouched", () => {
    const trades = [
      stubTrade({ id: "settle", actionNeeded: "settle" }),
      stubTrade({ id: "request", actionNeeded: "accept-or-decline" }),
    ];
    sortNeedsYou(trades);
    expect(ids(trades)).toEqual(["settle", "request"]);
  });

  it("returns nothing for no trades", () => {
    expect(sortNeedsYou([])).toEqual([]);
  });
});

describe("buildTradeShelf", () => {
  const empty = { needsYou: [], incoming: [], outgoing: [] };

  function details(shelf: ReturnType<typeof buildTradeShelf>): string[] {
    return shelf.rows.map((row) => `${row.key}: ${row.detail}`);
  }

  it("draws no row for a stage with nothing in it", () => {
    expect(
      details(
        buildTradeShelf({
          ...empty,
          needsYou: [stubTrade({ actionNeeded: "settle", role: "giver" })],
        }),
      ),
    ).toEqual(["hand-over: 1 card for Robin"]);
  });

  it("shrinks to a headline alone when the group is quiet", () => {
    expect(buildTradeShelf(empty)).toEqual({
      rows: [],
      waitingPeople: 0,
      headline: "No matches in this group yet",
    });
  });

  it("keeps the opportunity rows when nothing waits on the viewer", () => {
    const shelf = buildTradeShelf({ ...empty, incoming: [stubMatch()] });
    expect(shelf.headline).toBe("Nothing waiting on you");
    expect(details(shelf)).toEqual(["could-get: 1 card from 1 member"]);
  });

  it("splits the three obligation stages so no trade is counted twice", () => {
    const shelf = buildTradeShelf({
      ...empty,
      needsYou: [
        stubTrade({ id: "a", actionNeeded: "accept-or-decline", printingId: "printing-1" }),
        stubTrade({
          id: "b",
          actionNeeded: "settle",
          role: "giver",
          printingId: "printing-2",
        }),
        stubTrade({
          id: "c",
          actionNeeded: "settle",
          role: "receiver",
          printingId: "printing-3",
        }),
      ],
    });
    expect(details(shelf)).toEqual([
      "answer: 1 request from Robin",
      "hand-over: 1 card for Robin",
      "confirm: 1 card from Robin",
    ]);
    expect(shelf.rows.flatMap((row) => row.printingIds)).toEqual([
      "printing-1",
      "printing-2",
      "printing-3",
    ]);
  });

  it("names one person, joins two, and counts past that", () => {
    const withNames = (names: string[]) =>
      buildTradeShelf({
        ...empty,
        needsYou: names.map((name, index) =>
          stubTrade({
            id: `t-${index}`,
            actionNeeded: "settle",
            role: "giver",
            counterparty: {
              userId: `user-${index}`,
              name,
              image: null,
              gravatarHash: "hash",
              contactMethods: [],
            },
          }),
        ),
      });
    expect(details(withNames(["Robin"]))).toEqual(["hand-over: 1 card for Robin"]);
    expect(details(withNames(["Robin", "Alex"]))).toEqual([
      "hand-over: 2 cards for Alex and Robin",
    ]);
    expect(details(withNames(["Robin", "Alex", "Mo"]))).toEqual([
      "hand-over: 3 cards for 3 members",
    ]);
  });

  it("counts people, not trades, in the headline", () => {
    const shelf = buildTradeShelf({
      ...empty,
      needsYou: [
        stubTrade({ id: "a", actionNeeded: "settle", role: "giver" }),
        stubTrade({ id: "b", actionNeeded: "settle", role: "giver" }),
      ],
    });
    expect(shelf).toMatchObject({ waitingPeople: 1, headline: "1 person is waiting on you" });
  });

  it("counts two nameless members as two people, keyed by their ids", () => {
    const nameless = (id: string, userId: string) =>
      stubTrade({
        id,
        actionNeeded: "settle",
        role: "giver",
        counterparty: { userId, name: null, image: null, gravatarHash: "h", contactMethods: [] },
      });
    const shelf = buildTradeShelf({
      ...empty,
      needsYou: [nameless("a", "user-a"), nameless("b", "user-b")],
    });
    expect(shelf).toMatchObject({ waitingPeople: 2 });
  });

  it("appends the expiry tail to the requests row only", () => {
    const soon = new Date("2026-08-02T10:00:00.000Z").toISOString();
    const shelf = buildTradeShelf({
      ...empty,
      needsYou: [
        stubTrade({ id: "a", actionNeeded: "accept-or-decline", expiresAt: soon }),
        stubTrade({ id: "b", actionNeeded: "settle", role: "giver" }),
      ],
      now: new Date("2026-08-01T10:00:00.000Z"),
    });
    expect(details(shelf)).toEqual([
      "answer: 1 request from Robin, 1 expires soon",
      "hand-over: 1 card for Robin",
    ]);
  });

  it("counts distinct suggestions but shows distinct printings", () => {
    const shelf = buildTradeShelf({
      ...empty,
      incoming: [
        stubMatch({ counterpartyUserId: "user-2" }),
        stubMatch({ counterpartyUserId: "user-3" }),
      ],
    });
    expect(details(shelf)).toEqual(["could-get: 2 cards from 2 members"]);
    expect(shelf.rows[0]?.printingIds).toEqual(["printing-1"]);
  });

  it("keeps the two suggestion directions apart", () => {
    const shelf = buildTradeShelf({
      ...empty,
      incoming: [stubMatch({ printingId: "printing-1" })],
      outgoing: [stubMatch({ printingId: "printing-2", buyEntryId: "entry-2" })],
    });
    expect(details(shelf)).toEqual([
      "could-get: 1 card from 1 member",
      "would-want: 1 card, wanted by 1 member",
    ]);
  });

  it("names a live counterparty without a name as unnamed", () => {
    expect(
      details(
        buildTradeShelf({
          ...empty,
          needsYou: [
            stubTrade({
              actionNeeded: "settle",
              role: "receiver",
              counterparty: {
                userId: "user-2",
                name: null,
                image: null,
                gravatarHash: "hash",
                contactMethods: [],
              },
            }),
          ],
        }),
      ),
    ).toEqual(["confirm: 1 card from Unnamed member"]);
  });

  it("names a closed counterparty account as a former member", () => {
    expect(
      details(
        buildTradeShelf({
          ...empty,
          needsYou: [
            stubTrade({
              actionNeeded: "settle",
              role: "receiver",
              counterparty: {
                userId: null,
                name: null,
                image: null,
                gravatarHash: "hash",
                contactMethods: [],
              },
            }),
          ],
        }),
      ),
    ).toEqual(["confirm: 1 card from Former member"]);
  });
});
