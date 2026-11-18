import {
  cardTradeState,
  isTradedCardTrade,
  needsViewerAction,
} from "@openrift/shared/card-trade-lifecycle";
import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";

import { compareNeedsYou, sortNeedsYou } from "./trade-hub";
import { newAgreedTrades } from "./trade-seen";

export interface TradesIndexPerson {
  userId: string;
  name: string | null;
  image: string | null;
  gravatarHash: string;
  needsYou: CardTradeResponse[];
  toSwap: CardTradeResponse[];
  waiting: CardTradeResponse[];
  newAgreedCount: number;
  doneCount: number;
  groupNames: string[];
  lastActivityAt: string;
}

export interface TradesIndex {
  yourMove: TradesIndexPerson[];
  toSwap: TradesIndexPerson[];
  waiting: TradesIndexPerson[];
  past: TradesIndexPerson[];
  groupCount: number;
}

function personName(person: TradesIndexPerson): string {
  return person.name ?? "\u{FFFF}";
}

function compareByName(a: TradesIndexPerson, b: TradesIndexPerson): number {
  return personName(a).localeCompare(personName(b));
}

function compareByUrgency(a: TradesIndexPerson, b: TradesIndexPerson): number {
  const first = a.needsYou[0];
  const second = b.needsYou[0];
  if (first === undefined || second === undefined) {
    return compareByName(a, b);
  }
  return compareNeedsYou(first, second) || compareByName(a, b);
}

function compareByActivity(a: TradesIndexPerson, b: TradesIndexPerson): number {
  return b.lastActivityAt.localeCompare(a.lastActivityAt);
}

function sortedNames(names: Iterable<string>): string[] {
  return [...new Set(names)].toSorted((a, b) => a.localeCompare(b));
}

export function selectedTradesGroup<TGroup extends { slug: string }>(
  groups: readonly TGroup[],
  groupSlug?: string,
): TGroup | undefined {
  return groupSlug === undefined ? undefined : groups.find((group) => group.slug === groupSlug);
}

export function tradesInGroup(
  trades: readonly CardTradeResponse[],
  groupSlug: string | null,
): CardTradeResponse[] {
  return groupSlug === null ? [...trades] : trades.filter((trade) => trade.groupSlug === groupSlug);
}

/** A counterparty whose account is gone has no sheet to open, so their trades stay out of the index. */
export function buildTradesIndex(trades: readonly CardTradeResponse[]): TradesIndex {
  const byPerson = Map.groupBy(trades, (trade) => trade.counterparty.userId);
  const people: TradesIndexPerson[] = [];
  for (const [userId, own] of byPerson) {
    const latest = own[0];
    if (userId === null || latest === undefined) {
      continue;
    }
    people.push({
      userId,
      name: latest.counterparty.name,
      image: latest.counterparty.image,
      gravatarHash: latest.counterparty.gravatarHash,
      needsYou: sortNeedsYou(own.filter((trade) => needsViewerAction(trade))),
      toSwap: own.filter((trade) => cardTradeState(trade) === "to-swap"),
      waiting: own.filter((trade) => cardTradeState(trade) === "waiting-on-them"),
      newAgreedCount: newAgreedTrades(own).length,
      doneCount: own.filter((trade) => isTradedCardTrade(trade)).length,
      groupNames: sortedNames(own.map((trade) => trade.groupName)),
      lastActivityAt: own.reduce(
        (max, trade) => (trade.updatedAt > max ? trade.updatedAt : max),
        latest.updatedAt,
      ),
    });
  }
  return {
    yourMove: people.filter((person) => person.needsYou.length > 0).toSorted(compareByUrgency),
    toSwap: people
      .filter((person) => person.needsYou.length === 0 && person.toSwap.length > 0)
      .toSorted(compareByName),
    waiting: people
      .filter(
        (person) =>
          person.needsYou.length === 0 && person.toSwap.length === 0 && person.waiting.length > 0,
      )
      .toSorted(compareByName),
    past: people
      .filter(
        (person) =>
          person.needsYou.length === 0 && person.toSwap.length === 0 && person.waiting.length === 0,
      )
      .toSorted(compareByActivity),
    groupCount: new Set(trades.map((trade) => trade.groupId)).size,
  };
}
