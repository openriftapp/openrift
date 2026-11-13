import type { PriceTotal } from "@openrift/shared/card-price";
import { priceTotal } from "@openrift/shared/card-price";
import {
  cardTradeLivePhaseRank,
  cardTradeState,
  isLiveCardTradeStatus,
} from "@openrift/shared/card-trade-lifecycle";
import type { LabelMap } from "@openrift/shared/enum-label";
import { enumLabel } from "@openrift/shared/enum-label";
import type {
  CardTradeLiveAnnotation,
  CardTradeResponse,
} from "@openrift/shared/types/api/card-trade";
import type { FriendGroupMatchRow } from "@openrift/shared/types/api/friend-group";
import type { Printing } from "@openrift/shared/types/catalog";

import { m } from "@/paraglide/messages.js";

export type TradeSection = "action-needed" | "active" | "history";

export function tradeSection(trade: CardTradeResponse): TradeSection {
  switch (cardTradeState(trade)) {
    case "to-answer":
    case "to-settle": {
      return "action-needed";
    }
    case "waiting-on-them": {
      return "active";
    }
    case "done":
    case "closed": {
      return "history";
    }
  }
}

function liveTradeKey(
  counterpartyUserId: string,
  printingId: string,
  role: CardTradeResponse["role"],
): string {
  return `${counterpartyUserId}\0${printingId}\0${role}`;
}

function viewerRole(direction: MatchDirection): CardTradeResponse["role"] {
  return direction === "incoming" ? "receiver" : "giver";
}

export function liveTradeIndex(
  trades: readonly CardTradeResponse[],
): ReadonlyMap<string, CardTradeResponse> {
  const index = new Map<string, CardTradeResponse>();
  for (const trade of trades) {
    const counterpartyUserId = trade.counterparty.userId;
    if (isLiveCardTradeStatus(trade.status) && counterpartyUserId !== null) {
      index.set(liveTradeKey(counterpartyUserId, trade.printingId, trade.role), trade);
    }
  }
  return index;
}

export function liveTradeFor(
  index: ReadonlyMap<string, CardTradeResponse>,
  match: { counterpartyUserId: string; printingId: string },
  direction: MatchDirection,
): CardTradeResponse | undefined {
  return index.get(liveTradeKey(match.counterpartyUserId, match.printingId, viewerRole(direction)));
}

export function liveTradesForCard(
  trades: readonly CardTradeResponse[],
  cardId: string,
  direction: MatchDirection,
  exceptTradeIds: readonly string[] = [],
): CardTradeResponse[] {
  const role = viewerRole(direction);
  return trades.filter(
    (trade) =>
      trade.cardId === cardId &&
      trade.role === role &&
      !exceptTradeIds.includes(trade.id) &&
      isLiveCardTradeStatus(trade.status),
  );
}

/** Reserved trades are already netted server-side; this only covers the pending window. */
export function withoutLiveTradeMatches<
  TMatch extends { counterpartyUserId: string; printingId: string },
>(
  matches: readonly TMatch[],
  trades: readonly CardTradeResponse[],
  direction: MatchDirection,
): TMatch[] {
  const index = liveTradeIndex(trades);
  return matches.filter((match) => liveTradeFor(index, match, direction) === undefined);
}

const NO_PREFERENCE: FriendGroupMatchRow["sellPref"] = {
  pricePref: null,
  priceAbsoluteCents: null,
  tradeType: null,
  currency: null,
};

export type LiveOnlyMatchRow = FriendGroupMatchRow & {
  groupId: string;
  groupSlug: string;
  liveOnly: true;
};

export function liveOnlyMatchRows(
  trades: readonly CardTradeResponse[],
  matches: readonly { counterpartyUserId: string; printingId: string }[],
  direction: MatchDirection,
  printingOf: (trade: CardTradeResponse) => Printing | undefined,
): LiveOnlyMatchRow[] {
  const shown = new Set(matches.map((match) => `${match.counterpartyUserId}\0${match.printingId}`));
  const rows: LiveOnlyMatchRow[] = [];
  for (const trade of trades) {
    const counterpartyUserId = trade.counterparty.userId;
    const printing = printingOf(trade);
    if (
      !isLiveCardTradeStatus(trade.status) ||
      trade.role !== viewerRole(direction) ||
      counterpartyUserId === null ||
      trade.groupId === null ||
      trade.groupSlug === null ||
      printing === undefined ||
      shown.has(`${counterpartyUserId}\0${trade.printingId}`)
    ) {
      continue;
    }
    shown.add(`${counterpartyUserId}\0${trade.printingId}`);
    rows.push({
      counterpartyUserId,
      counterpartyName: trade.counterparty.name,
      counterpartyImage: trade.counterparty.image,
      counterpartyGravatarHash: trade.counterparty.gravatarHash,
      counterpartyListId: `trade:${trade.id}`,
      counterpartyListName: "",
      viewerListName: "",
      sellEntryId: null,
      sellListId: "",
      copyId: "",
      condition: null,
      grader: null,
      grade: null,
      notesPublic: null,
      printingId: trade.printingId,
      cardId: trade.cardId,
      cardName: printing.card.name,
      setId: printing.setId,
      rarity: printing.rarity,
      finish: printing.finish,
      imageId: printing.images[0]?.imageId ?? null,
      buyEntryId: trade.viewerWishEntryId ?? `trade:${trade.id}`,
      buyListId: "",
      buyEntryKind: "printing",
      buyQuantity: trade.quantity,
      sellPref: NO_PREFERENCE,
      buyPref: NO_PREFERENCE,
      groupId: trade.groupId,
      groupSlug: trade.groupSlug,
      liveOnly: true,
    });
  }
  return rows;
}

export interface MemberTradeBuckets {
  active: CardTradeResponse[];
  actionNeeded: CardTradeResponse[];
  history: CardTradeResponse[];
}

export function bucketMemberTrades(
  trades: readonly CardTradeResponse[],
  counterpartyUserId: string,
): MemberTradeBuckets {
  const mine = trades.filter((trade) => trade.counterparty.userId === counterpartyUserId);
  return {
    active: mine.filter((trade) => tradeSection(trade) === "active"),
    actionNeeded: mine.filter((trade) => tradeSection(trade) === "action-needed"),
    history: mine.filter((trade) => tradeSection(trade) === "history"),
  };
}

export type MatchDirection = "incoming" | "outgoing";

export type MatchSuggestionFields = Pick<
  FriendGroupMatchRow,
  | "buyEntryKind"
  | "buyEntryId"
  | "cardId"
  | "counterpartyUserId"
  | "counterpartyListId"
  | "printingId"
>;

/** Must match the grouping key `groupTradeMatches` uses in match-row-card.tsx. */
export function matchSuggestionKey(direction: MatchDirection, row: MatchSuggestionFields): string {
  // Rule-derived wishes have a null buyEntryId; fall back to cardId so
  // distinct rule wishes don't collapse onto one tile.
  const wishKey = row.buyEntryId ?? row.cardId;
  return row.buyEntryKind === "card"
    ? `card\0${direction}\0${row.counterpartyUserId}\0${wishKey}`
    : `printing\0${direction}\0${row.counterpartyUserId}\0${wishKey}\0${row.counterpartyListId}\0${row.printingId}`;
}

/**
 * No group in the key, so the same card reachable through two shared groups
 * counts as one suggestion, not two.
 */
export function tradeSuggestionKeys(
  incoming: readonly MatchSuggestionFields[],
  outgoing: readonly MatchSuggestionFields[],
): Set<string> {
  const keys = new Set<string>();
  for (const row of incoming) {
    keys.add(matchSuggestionKey("incoming", row));
  }
  for (const row of outgoing) {
    keys.add(matchSuggestionKey("outgoing", row));
  }
  return keys;
}

export function countTradeSuggestions(
  incoming: readonly MatchSuggestionFields[],
  outgoing: readonly MatchSuggestionFields[],
): number {
  return tradeSuggestionKeys(incoming, outgoing).size;
}

export interface GroupMatchPanels<TMatch> {
  slug: string;
  incoming: readonly TMatch[];
  outgoing: readonly TMatch[];
}

export interface GroupSuggestionStrip {
  count: number;
  printingIds: string[];
}

export interface GroupSuggestionStrips {
  incoming: GroupSuggestionStrip;
  outgoing: GroupSuggestionStrip;
}

function suggestionStrip<TMatch extends MatchSuggestionFields>(
  matches: readonly TMatch[],
  direction: MatchDirection,
): GroupSuggestionStrip {
  return {
    count:
      direction === "incoming"
        ? tradeSuggestionKeys(matches, []).size
        : tradeSuggestionKeys([], matches).size,
    printingIds: [...new Set(matches.map((match) => match.printingId))],
  };
}

export function groupSuggestionStripsBySlug<TMatch extends MatchSuggestionFields>(
  groups: readonly GroupMatchPanels<TMatch>[],
  trades: readonly CardTradeResponse[],
): Map<string, GroupSuggestionStrips> {
  return new Map(
    groups.map((group) => [
      group.slug,
      {
        incoming: suggestionStrip(
          withoutLiveTradeMatches(group.incoming, trades, "incoming"),
          "incoming",
        ),
        outgoing: suggestionStrip(
          withoutLiveTradeMatches(group.outgoing, trades, "outgoing"),
          "outgoing",
        ),
      },
    ]),
  );
}

export function describeViewerSource(
  direction: MatchDirection,
  listNames: readonly string[],
): string | null {
  return describeSource("your", direction === "incoming" ? "wishlist" : "tradelist", listNames);
}

export function describeCounterpartySource(
  direction: MatchDirection,
  listNames: readonly string[],
): string | null {
  return describeSource("their", direction === "incoming" ? "tradelist" : "wishlist", listNames);
}

function describeSource(
  owner: "your" | "their",
  kind: "wishlist" | "tradelist",
  listNames: readonly string[],
): string | null {
  const distinct = [...new Set(listNames.filter((name) => name.length > 0))];
  if (distinct.length === 0) {
    return null;
  }
  const capitalized = owner === "your" ? "Your" : "Their";
  if (distinct.length === 1) {
    return `${capitalized} ${kind}: ${distinct[0]}`;
  }
  return `${distinct.length} of ${owner} ${kind}s`;
}

export interface MatchCopyDetail {
  condition: string | null;
  grader: string | null;
  grade: number | null;
  notesPublic: string | null;
}

/** Mirrors the collection dialog's condition badge. */
export function matchCopyConditionLabel(
  copy: MatchCopyDetail,
  labels: { conditions: LabelMap; graders: LabelMap },
): string | null {
  if (copy.grader !== null && copy.grade !== null) {
    return `${enumLabel(labels.graders, copy.grader)} ${copy.grade}`;
  }
  if (copy.condition !== null) {
    return enumLabel(labels.conditions, copy.condition);
  }
  return null;
}

export interface CopyConditionGroup {
  short: string;
  full: string;
  count: number;
}

export function groupMatchCopyConditions(
  copies: readonly MatchCopyDetail[],
  labelOf: (copy: MatchCopyDetail) => { short: string; full: string } | null,
): CopyConditionGroup[] {
  const groups = new Map<string, CopyConditionGroup>();
  for (const copy of copies) {
    const label = labelOf(copy);
    if (label === null) {
      continue;
    }
    const existing = groups.get(label.full);
    if (existing === undefined) {
      groups.set(label.full, { ...label, count: 1 });
    } else {
      existing.count += 1;
    }
  }
  return [...groups.values()];
}

export function summarizeMatchCopies(
  copies: readonly MatchCopyDetail[],
  labelOf: (copy: MatchCopyDetail) => string | null,
): { conditions: string | null; notes: string[] } {
  const counts = new Map<string, number>();
  let unrecorded = 0;
  for (const copy of copies) {
    const label = labelOf(copy);
    if (label === null) {
      unrecorded += 1;
    } else {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  const notes = [
    ...new Set(
      copies.map((copy) => copy.notesPublic?.trim() ?? "").filter((note) => note.length > 0),
    ),
  ];
  if (counts.size === 0) {
    return { conditions: null, notes };
  }
  const withCount = (label: string, count: number): string =>
    count > 1 ? `${label} ×${count}` : label;
  const parts = [...counts.entries()].map(([label, count]) => withCount(label, count));
  if (unrecorded > 0) {
    parts.push(withCount("not recorded", unrecorded));
  }
  return { conditions: parts.join(" · "), notes };
}

export function tradeStatusLabel(status: CardTradeResponse["status"]): string {
  switch (status) {
    case "pending": {
      return m.trades_status_pending();
    }
    case "reserved": {
      return m.trades_status_reserved();
    }
    case "completed": {
      return m.trades_status_completed();
    }
    case "declined": {
      return m.trades_status_declined();
    }
    case "cancelled": {
      return m.trades_status_cancelled();
    }
    case "expired": {
      return m.trades_status_expired();
    }
  }
}

export function maxTradeQuantity(demandQuantity: number, availableCount: number): number {
  return Math.max(0, Math.min(demandQuantity, availableCount));
}

/** Drops receiver-side annotations when a giver-side one exists for the same printing. */
export function groupTradeAnnotationsByPrinting(
  annotations: readonly CardTradeLiveAnnotation[],
): Map<string, CardTradeLiveAnnotation[]> {
  const byPrinting = Map.groupBy(annotations, (annotation) => annotation.printingId);
  for (const [printingId, group] of byPrinting) {
    if (group.some((entry) => entry.role === "giver")) {
      byPrinting.set(
        printingId,
        group.filter((entry) => entry.role === "giver"),
      );
    }
  }
  return byPrinting;
}

/**
 * Ties on phase favor giver over receiver. Never sum counts across a side:
 * one reserved plus two pending trades on a printing is one copy, not three.
 */
export function collapseTradeAnnotations(
  annotations: readonly CardTradeLiveAnnotation[],
): CardTradeLiveAnnotation | null {
  // Adding a half step ranks giver above receiver at equal phase without
  // crossing into the next phase.
  const rank = (entry: CardTradeLiveAnnotation): number =>
    cardTradeLivePhaseRank(entry.phase) + (entry.role === "giver" ? 0.5 : 0);
  return annotations.reduce<CardTradeLiveAnnotation | null>(
    (best, entry) => (best === null || rank(entry) > rank(best) ? entry : best),
    null,
  );
}

/**
 * Uses the group id while it exists, else the name it was deleted under. Two
 * different deleted groups sharing a name collapse into one identity.
 */
export function tradeGroupKey(trade: Pick<CardTradeResponse, "groupId" | "groupName">): string {
  return trade.groupId ?? `name:${trade.groupName}`;
}

export interface TradeCounterpartyGroup {
  counterparty: CardTradeResponse["counterparty"];
  trades: CardTradeResponse[];
}

export function groupTradesByCounterparty(
  trades: readonly CardTradeResponse[],
): TradeCounterpartyGroup[] {
  const byId = new Map<string, TradeCounterpartyGroup>();
  for (const trade of trades) {
    // A counterparty who deleted their account has no id left, so their
    // snapshotted name is the only identity their finished trades still carry.
    const key = trade.counterparty.userId ?? `name:${trade.counterparty.name ?? ""}`;
    let group = byId.get(key);
    if (!group) {
      group = { counterparty: trade.counterparty, trades: [] };
      byId.set(key, group);
    }
    group.trades.push(trade);
  }
  return [...byId.values()].sort(
    (a, b) =>
      b.trades.length - a.trades.length ||
      (a.counterparty.name ?? "").localeCompare(b.counterparty.name ?? ""),
  );
}

export interface TradeValueSplit {
  get: PriceTotal;
  give: PriceTotal;
}

export function sumTradeValues(
  trades: readonly CardTradeResponse[],
  unitPrice: (printingId: string) => number | undefined,
): TradeValueSplit {
  const side = (receiving: boolean) =>
    priceTotal(
      trades
        .filter((trade) => (trade.role === "receiver") === receiving)
        .map((trade) => ({ price: unitPrice(trade.printingId), quantity: trade.quantity })),
    );
  return { get: side(true), give: side(false) };
}
