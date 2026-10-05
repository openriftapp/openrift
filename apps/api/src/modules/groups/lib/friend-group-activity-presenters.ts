import type { FriendGroupActivityEvent } from "@openrift/shared/types/api/friend-group";

import { gravatarHashForEmail } from "../../../lib/gravatar.js";
import type { CompletedTradeFeedRow } from "../repositories/card-trades-reads.js";
import type { IncomingMatchFeedRow } from "../repositories/friend-group-matches-view.js";
import type { MemberWithUser } from "../repositories/friend-groups-shared.js";
import type { CollectionShareRow, ShareRow } from "./friend-group-presenters.js";

export function toTradeCompletedEvent(row: CompletedTradeFeedRow): FriendGroupActivityEvent {
  return {
    kind: "trade-completed",
    at: row.completedAt.toISOString(),
    tradeId: row.tradeId,
    printingId: row.printingId,
    cardId: row.cardId,
    quantity: row.quantity,
    giverUserId: row.giverUserId,
    giverName: row.giverName,
    receiverUserId: row.receiverUserId,
    receiverName: row.receiverName,
  };
}

export function toMemberJoinedEvent(row: MemberWithUser): FriendGroupActivityEvent {
  return {
    kind: "member-joined",
    at: row.joinedAt.toISOString(),
    userId: row.userId,
    userName: row.userName,
    userImage: row.userImage,
    gravatarHash: gravatarHashForEmail(row.userEmail),
  };
}

export function toListSharedEvent(row: ShareRow): FriendGroupActivityEvent {
  return {
    kind: "list-shared",
    at: row.sharedAt.toISOString(),
    userId: row.userId,
    userName: row.userName,
    listId: row.listId,
    listName: row.listName,
    listIntent: row.listIntent as Extract<
      FriendGroupActivityEvent,
      { kind: "list-shared" }
    >["listIntent"],
    listKind: row.listKind as Extract<
      FriendGroupActivityEvent,
      { kind: "list-shared" }
    >["listKind"],
  };
}

export function toCollectionSharedEvent(row: CollectionShareRow): FriendGroupActivityEvent {
  return {
    kind: "collection-shared",
    at: row.sharedAt.toISOString(),
    userId: row.userId,
    userName: row.userName,
    collectionId: row.collectionId,
    collectionName: row.collectionName,
  };
}

export function toMatchEvent(row: IncomingMatchFeedRow): FriendGroupActivityEvent {
  return {
    kind: "match",
    at: row.matchedAt.toISOString(),
    counterpartyUserId: row.counterpartyUserId,
    counterpartyName: row.counterpartyName,
    counterpartyImage: row.counterpartyImage,
    counterpartyGravatarHash: row.counterpartyGravatarHash,
    printingId: row.printingId,
    cardId: row.cardId,
  };
}
