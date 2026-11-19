import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";
import { describe, expect, it } from "vitest";

import { buildTradesIndex, selectedTradesGroup, tradesInGroup } from "./trades-index";

function stubTrade(overrides: Partial<CardTradeResponse> = {}): CardTradeResponse {
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
    autoAccepted: false,
    recipientSeenAt: null,
    actionNeeded: null,
    ...overrides,
  };
}

function withPerson(userId: string | null, name: string | null): Partial<CardTradeResponse> {
  return { counterparty: { userId, name, image: null, gravatarHash: "h", contactMethods: [] } };
}

describe("buildTradesIndex", () => {
  it("returns empty sections for no trades", () => {
    expect(buildTradesIndex([])).toEqual({
      yourMove: [],
      toSwap: [],
      waiting: [],
      past: [],
      groupCount: 0,
    });
  });

  it("files a person under your move when any trade needs the viewer", () => {
    const index = buildTradesIndex([
      stubTrade({ id: "a", actionNeeded: "accept-or-decline" }),
      stubTrade({ id: "b", status: "completed", completedAt: "2026-08-02T10:00:00.000Z" }),
    ]);
    expect(index.yourMove.map((person) => person.userId)).toEqual(["user-2"]);
    expect(index.waiting).toEqual([]);
    expect(index.yourMove[0]?.needsYou.map((trade) => trade.id)).toEqual(["a"]);
    expect(index.yourMove[0]?.doneCount).toBe(1);
  });

  it("also lists a person with a live trade under past once a trade with them is done", () => {
    const index = buildTradesIndex([
      stubTrade({ id: "a", actionNeeded: "accept-or-decline" }),
      stubTrade({ id: "b", status: "completed", completedAt: "2026-08-02T10:00:00.000Z" }),
      stubTrade({ id: "c", actionNeeded: "cancel", ...withPerson("user-3", "Ash") }),
    ]);
    expect(index.past.map((person) => person.userId)).toEqual(["user-2"]);
  });

  it("files a person under waiting when only they have a move left", () => {
    const index = buildTradesIndex([stubTrade({ actionNeeded: "cancel" })]);
    expect(index.waiting.map((person) => person.userId)).toEqual(["user-2"]);
    expect(index.waiting[0]?.waiting).toHaveLength(1);
  });

  it("files people with a done trade under past, newest first, and leaves out closed-only ones", () => {
    const index = buildTradesIndex([
      stubTrade({
        id: "old",
        status: "completed",
        updatedAt: "2026-07-01T10:00:00.000Z",
        ...withPerson("user-3", "Ash"),
      }),
      stubTrade({ id: "new", status: "completed", updatedAt: "2026-08-05T10:00:00.000Z" }),
      stubTrade({ id: "closed", status: "declined", updatedAt: "2026-08-06T10:00:00.000Z" }),
      stubTrade({ id: "expired", status: "expired", ...withPerson("user-4", "Kai") }),
    ]);
    expect(index.past.map((person) => person.userId)).toEqual(["user-2", "user-3"]);
    expect(index.past[0]?.doneCount).toBe(1);
    expect(index.past[0]?.lastActivityAt).toBe("2026-08-06T10:00:00.000Z");
  });

  it("orders your move by the most urgent trade, then by name", () => {
    const index = buildTradesIndex([
      stubTrade({
        id: "settle-only",
        status: "reserved",
        actionNeeded: "settle",
        counterpartySyncAppliedAt: "2026-08-02T10:00:00.000Z",
        ...withPerson("user-3", "Ash"),
      }),
      stubTrade({
        id: "later",
        actionNeeded: "accept-or-decline",
        expiresAt: "2026-08-09T10:00:00.000Z",
        ...withPerson("user-4", "Zed"),
      }),
      stubTrade({
        id: "soon",
        actionNeeded: "accept-or-decline",
        expiresAt: "2026-08-03T10:00:00.000Z",
      }),
    ]);
    expect(index.yourMove.map((person) => person.userId)).toEqual(["user-2", "user-4", "user-3"]);
  });

  it("files an agreed swap under to swap until the other side settles", () => {
    const index = buildTradesIndex([
      stubTrade({ id: "swap", status: "reserved", actionNeeded: "settle" }),
      stubTrade({ id: "sent", actionNeeded: "cancel" }),
    ]);
    expect(index.yourMove).toEqual([]);
    expect(index.waiting).toEqual([]);
    expect(index.toSwap.map((person) => person.userId)).toEqual(["user-2"]);
    expect(index.toSwap[0]?.toSwap.map((trade) => trade.id)).toEqual(["swap"]);
  });

  it("moves a swap to your move once the other side has settled", () => {
    const index = buildTradesIndex([
      stubTrade({
        id: "swap",
        status: "reserved",
        actionNeeded: "settle",
        counterpartySyncAppliedAt: "2026-08-02T10:00:00.000Z",
      }),
    ]);
    expect(index.toSwap).toEqual([]);
    expect(index.yourMove[0]?.needsYou.map((trade) => trade.id)).toEqual(["swap"]);
  });

  it("sorts waiting people by name with the nameless last", () => {
    const index = buildTradesIndex([
      stubTrade({ id: "a", actionNeeded: "cancel", ...withPerson("user-5", null) }),
      stubTrade({ id: "b", actionNeeded: "cancel", ...withPerson("user-4", "Zed") }),
      stubTrade({ id: "c", actionNeeded: "cancel", ...withPerson("user-3", "Ash") }),
    ]);
    expect(index.waiting.map((person) => person.userId)).toEqual(["user-3", "user-4", "user-5"]);
  });

  it("collects the distinct group names per person and counts groups overall", () => {
    const index = buildTradesIndex([
      stubTrade({ id: "a", actionNeeded: "cancel" }),
      stubTrade({
        id: "b",
        actionNeeded: "cancel",
        groupId: "group-2",
        groupSlug: "arcane-league",
        groupName: "Arcane League",
      }),
      stubTrade({ id: "c", actionNeeded: "cancel" }),
    ]);
    expect(index.waiting[0]?.groupNames).toEqual(["Arcane League", "Summoner Skirmish"]);
    expect(index.groupCount).toBe(2);
  });

  it("leaves out trades whose counterparty account is gone", () => {
    const index = buildTradesIndex([
      stubTrade({ status: "completed", ...withPerson(null, "Gone") }),
    ]);
    expect(index.past).toEqual([]);
    expect(index.groupCount).toBe(1);
  });
});

describe("selectedTradesGroup", () => {
  const groups = [{ slug: "summoner-skirmish" }, { slug: "piltover-club" }];

  it("finds the group the address names", () => {
    expect(selectedTradesGroup(groups, "piltover-club")).toEqual({ slug: "piltover-club" });
  });

  it("selects nothing without a group in the address", () => {
    expect(selectedTradesGroup(groups)).toBeUndefined();
  });

  it("selects nothing for a group the viewer is not in", () => {
    expect(selectedTradesGroup(groups, "zaun-traders")).toBeUndefined();
  });
});

describe("tradesInGroup", () => {
  const here = stubTrade({ id: "here" });
  const elsewhere = stubTrade({ id: "elsewhere", groupSlug: "piltover-club" });

  it("keeps every trade when no group is selected", () => {
    expect(tradesInGroup([here, elsewhere], null)).toEqual([here, elsewhere]);
  });

  it("keeps only the selected group's trades", () => {
    expect(tradesInGroup([here, elsewhere], "piltover-club")).toEqual([elsewhere]);
  });

  it("drops trades whose group is gone", () => {
    expect(tradesInGroup([stubTrade({ groupSlug: null })], "summoner-skirmish")).toEqual([]);
  });
});

describe("buildTradesIndex new agreed trades", () => {
  it("counts the trades a person's send agreed that the viewer has not looked at", () => {
    const agreed = stubTrade({
      id: "agreed",
      status: "reserved",
      initiator: "giver",
      role: "receiver",
      autoAccepted: true,
    });
    const seen = stubTrade({
      id: "seen",
      status: "reserved",
      initiator: "giver",
      role: "receiver",
      autoAccepted: true,
      recipientSeenAt: "2026-11-18T10:00:00.000Z",
    });
    const index = buildTradesIndex([agreed, seen]);
    const [person] = [...index.yourMove, ...index.toSwap, ...index.waiting, ...index.past];
    expect(person?.newAgreedCount).toBe(1);
  });
});
