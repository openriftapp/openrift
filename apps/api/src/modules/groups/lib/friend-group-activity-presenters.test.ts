import { describe, expect, it } from "vitest";

import { gravatarHashForEmail } from "../../../lib/gravatar.js";
import {
  toCollectionSharedEvent,
  toListSharedEvent,
  toMatchEvent,
  toMemberJoinedEvent,
  toTradeCompletedEvent,
} from "./friend-group-activity-presenters.js";

const AT = new Date("2026-03-01T10:00:00.000Z");
const AT_ISO = "2026-03-01T10:00:00.000Z";

describe("friend group activity events", () => {
  it("maps a completed trade", () => {
    expect(
      toTradeCompletedEvent({
        tradeId: "t1",
        printingId: "p1",
        cardId: "c1",
        quantity: 2,
        completedAt: AT,
        giverUserId: null,
        giverName: "Gone",
        receiverUserId: "u2",
        receiverName: "Lux",
      }),
    ).toEqual({
      kind: "trade-completed",
      at: AT_ISO,
      tradeId: "t1",
      printingId: "p1",
      cardId: "c1",
      quantity: 2,
      giverUserId: null,
      giverName: "Gone",
      receiverUserId: "u2",
      receiverName: "Lux",
    });
  });

  it("maps a member join with a gravatar hash", () => {
    expect(
      toMemberJoinedEvent({
        groupId: "g1",
        userId: "u1",
        role: "member",
        joinedAt: AT,
        userName: "Teemo",
        userEmail: "teemo@example.com",
        userImage: null,
      } as Parameters<typeof toMemberJoinedEvent>[0]),
    ).toEqual({
      kind: "member-joined",
      at: AT_ISO,
      userId: "u1",
      userName: "Teemo",
      userImage: null,
      gravatarHash: gravatarHashForEmail("teemo@example.com"),
    });
  });

  it("maps a list share", () => {
    expect(
      toListSharedEvent({
        groupId: "g1",
        listId: "l1",
        userId: "u1",
        sharedAt: AT,
        listName: "Binder",
        listIntent: "trade",
        listKind: "copy",
        entryCount: 3,
        userName: "Teemo",
      }),
    ).toEqual({
      kind: "list-shared",
      at: AT_ISO,
      userId: "u1",
      userName: "Teemo",
      listId: "l1",
      listName: "Binder",
      listIntent: "trade",
      listKind: "copy",
    });
  });

  it("maps a collection share", () => {
    expect(
      toCollectionSharedEvent({
        groupId: "g1",
        collectionId: "col1",
        userId: "u1",
        sharedAt: AT,
        collectionName: "Main",
        userName: null,
        copyCount: 10,
      }),
    ).toEqual({
      kind: "collection-shared",
      at: AT_ISO,
      userId: "u1",
      userName: null,
      collectionId: "col1",
      collectionName: "Main",
    });
  });

  it("maps an incoming match", () => {
    expect(
      toMatchEvent({
        counterpartyUserId: "u2",
        counterpartyName: "Lux",
        counterpartyImage: null,
        counterpartyGravatarHash: "hash",
        printingId: "p1",
        cardId: "c1",
        matchedAt: AT,
      }),
    ).toEqual({
      kind: "match",
      at: AT_ISO,
      counterpartyUserId: "u2",
      counterpartyName: "Lux",
      counterpartyImage: null,
      counterpartyGravatarHash: "hash",
      printingId: "p1",
      cardId: "c1",
    });
  });
});
