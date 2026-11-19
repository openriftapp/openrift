import { HOUR_MS } from "@openrift/shared/format-date";
import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";

import { memberName } from "@/lib/member-name";
import { m } from "@/paraglide/messages.js";

import { distinctPrintingIds } from "./friend-group-activity";
import type { MatchDirection, MatchSuggestionFields } from "./trade-derivation";
import { matchSuggestionKey } from "./trade-derivation";

export interface NeedsYouCounts {
  toAnswer: number;
  toHandOver: number;
  toReceive: number;
}

export function needsYouCounts(needsYou: readonly CardTradeResponse[]): NeedsYouCounts {
  let toAnswer = 0;
  let toHandOver = 0;
  let toReceive = 0;
  for (const trade of needsYou) {
    if (trade.actionNeeded === "accept-or-decline") {
      toAnswer += 1;
    } else if (trade.actionNeeded === "settle") {
      if (trade.role === "giver") {
        toHandOver += 1;
      } else {
        toReceive += 1;
      }
    }
  }
  return { toAnswer, toHandOver, toReceive };
}

const EXPIRING_SOON_MS = 48 * HOUR_MS;

export function expiringSoonCount(
  needsYou: readonly CardTradeResponse[],
  now: Date = new Date(),
): number {
  const deadline = now.getTime() + EXPIRING_SOON_MS;
  return needsYou.filter(
    (trade) =>
      trade.actionNeeded === "accept-or-decline" &&
      trade.expiresAt !== null &&
      new Date(trade.expiresAt).getTime() <= deadline,
  ).length;
}

function needsYouRank(trade: CardTradeResponse): number {
  return trade.actionNeeded === "accept-or-decline" ? 0 : 1;
}

function compareExpiry(a: string | null, b: string | null): number {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return a.localeCompare(b);
}

export function compareNeedsYou(a: CardTradeResponse, b: CardTradeResponse): number {
  const byRank = needsYouRank(a) - needsYouRank(b);
  if (byRank !== 0) {
    return byRank;
  }
  if (needsYouRank(a) === 0) {
    const byExpiry = compareExpiry(a.expiresAt, b.expiresAt);
    if (byExpiry !== 0) {
      return byExpiry;
    }
  }
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function sortNeedsYou(trades: readonly CardTradeResponse[]): CardTradeResponse[] {
  return trades.toSorted(compareNeedsYou);
}

export function needsYouLine(
  needsYou: readonly CardTradeResponse[],
  now: Date = new Date(),
): string | null {
  if (needsYou.length === 0) {
    return null;
  }
  const { toAnswer, toHandOver, toReceive } = needsYouCounts(needsYou);
  const acts: string[] = [];
  if (toAnswer > 0) {
    acts.push(m.trades_to_answer({ count: toAnswer }));
  }
  if (toHandOver > 0) {
    acts.push(m.trades_to_hand_over({ count: toHandOver }));
  }
  if (toReceive > 0) {
    // Matches the overview band's "To confirm" label for the same stage.
    acts.push(m.trades_to_confirm({ count: toReceive }));
  }
  const parts = [acts.join(", ")];
  const soon = expiringSoonCount(needsYou, now);
  if (soon > 0) {
    parts.push(expiresSoonLine(soon));
  }
  return parts.join(" · ");
}

export function nextMoveLabel(trade: CardTradeResponse | undefined): string {
  if (trade?.actionNeeded === "accept-or-decline") {
    return m.trades_your_move_answer();
  }
  if (trade?.actionNeeded === "settle") {
    return m.trades_your_move_settle();
  }
  return m.trades_your_move_open();
}

interface TradeSuggestionSide {
  count: number;
  printingIds: string[];
}

function tradeSuggestionSide(
  direction: MatchDirection,
  matches: readonly MatchSuggestionFields[],
): TradeSuggestionSide {
  return {
    count: new Set(matches.map((match) => matchSuggestionKey(direction, match))).size,
    printingIds: distinctPrintingIds(matches),
  };
}

function expiresSoonLine(count: number): string {
  return m.trades_expire_soon({ count });
}

type TradeShelfRowKey = "answer" | "hand-over" | "confirm" | "could-get" | "would-want";

export interface TradeShelfRow {
  key: TradeShelfRowKey;
  label: string;
  tone: "warning" | "success";
  printingIds: string[];
  detail: string;
}

export interface TradeShelf {
  rows: TradeShelfRow[];
  waitingPeople: number;
  headline: string;
}

function memberPhrase(names: readonly string[]): string {
  if (names.length === 1) {
    return memberName(names[0]);
  }
  const [first, second] = names;
  if (names.length === 2 && first !== undefined && second !== undefined) {
    return m.trades_member_pair({ first, second });
  }
  return m.trades_member_count({ count: names.length });
}

function counterpartyNames(trades: readonly CardTradeResponse[]): string[] {
  const byParty = new Map<string, string>();
  for (const [index, trade] of trades.entries()) {
    const { userId, name } = trade.counterparty;
    byParty.set(userId ?? `closed:${index}`, memberName(name, userId === null));
  }
  return [...byParty.values()].sort((a, b) => a.localeCompare(b));
}

function cardCount(count: number): string {
  return m.common_cards({ count });
}

function memberCount(count: number): string {
  return m.trades_members({ count });
}

function obligationDetail(
  key: Extract<TradeShelfRowKey, "answer" | "hand-over" | "confirm">,
  count: number,
  who: string,
): string {
  if (key === "answer") {
    const requests = m.trades_requests({ count });
    return m.trades_detail_requests_from({ requests, who });
  }
  if (key === "hand-over") {
    return m.trades_detail_cards_for({ cards: cardCount(count), who });
  }
  return m.trades_detail_cards_from({ cards: cardCount(count), who });
}

function obligationRow(
  key: Extract<TradeShelfRowKey, "answer" | "hand-over" | "confirm">,
  label: string,
  trades: readonly CardTradeResponse[],
  tail: string,
): TradeShelfRow | null {
  if (trades.length === 0) {
    return null;
  }
  const detail = obligationDetail(key, trades.length, memberPhrase(counterpartyNames(trades)));
  return {
    key,
    label,
    tone: "warning",
    printingIds: distinctPrintingIds(trades),
    detail: tail === "" ? detail : m.trades_detail_with_tail({ detail, tail }),
  };
}

function suggestionRow(
  key: Extract<TradeShelfRowKey, "could-get" | "would-want">,
  label: string,
  matches: readonly MatchSuggestionFields[],
  direction: MatchDirection,
): TradeShelfRow | null {
  const { count, printingIds } = tradeSuggestionSide(direction, matches);
  if (count === 0) {
    return null;
  }
  const members = new Set(matches.map((match) => match.counterpartyUserId)).size;
  const detail =
    key === "could-get"
      ? m.trades_shelf_could_get_detail({ cards: cardCount(count), members: memberCount(members) })
      : m.trades_shelf_would_want_detail({
          cards: cardCount(count),
          members: memberCount(members),
        });
  return { key, label, tone: "success", printingIds, detail };
}

export function buildTradeShelf({
  needsYou,
  incoming,
  outgoing,
  now,
}: {
  needsYou: readonly CardTradeResponse[];
  incoming: readonly MatchSuggestionFields[];
  outgoing: readonly MatchSuggestionFields[];
  now?: Date;
}): TradeShelf {
  const sorted = sortNeedsYou(needsYou);
  const soon = expiringSoonCount(sorted, now);
  const expiry = soon === 0 ? "" : expiresSoonLine(soon);

  const rows = [
    obligationRow(
      "answer",
      m.trades_shelf_to_answer(),
      sorted.filter((trade) => trade.actionNeeded === "accept-or-decline"),
      expiry,
    ),
    obligationRow(
      "hand-over",
      m.trades_shelf_to_hand_over(),
      sorted.filter((trade) => trade.actionNeeded === "settle" && trade.role === "giver"),
      "",
    ),
    obligationRow(
      "confirm",
      m.trades_shelf_to_confirm(),
      sorted.filter((trade) => trade.actionNeeded === "settle" && trade.role === "receiver"),
      "",
    ),
    suggestionRow("could-get", m.trades_shelf_could_get(), incoming, "incoming"),
    suggestionRow("would-want", m.trades_shelf_would_want(), outgoing, "outgoing"),
  ].filter((row) => row !== null);

  const waitingPeople = counterpartyNames(sorted).length;
  return {
    rows,
    waitingPeople,
    headline:
      waitingPeople > 0
        ? m.trades_waiting_on_you({ count: waitingPeople })
        : rows.length > 0
          ? m.trades_nothing_waiting()
          : m.trades_no_matches_in_group(),
  };
}
