import type {
  CardTradeResponse,
  TradeSuggestionDismissal,
} from "@openrift/shared/types/api/card-trade";
import type { FriendGroupMatchRow } from "@openrift/shared/types/api/friend-group";

import type { MatchDirection } from "./trade-derivation";
import { withoutLiveTradeMatches } from "./trade-derivation";
import { dismissalKey } from "./trade-dismissals";

export interface TradeMarketGroup {
  slug: string;
  name: string;
  incoming: readonly FriendGroupMatchRow[];
  outgoing: readonly FriendGroupMatchRow[];
}

type TradeMarketRow = FriendGroupMatchRow & { groupSlug: string };

export interface TradeMarketSource {
  userId: string;
  name: string | null;
  image: string | null;
  gravatarHash: string;
  groupNames: string[];
}

export interface TradeMarketCard {
  direction: MatchDirection;
  printingId: string;
  cardId: string;
  sources: TradeMarketSource[];
  rows: TradeMarketRow[];
  swapUserIds: string[];
}

export interface TradeMarket {
  incoming: TradeMarketCard[];
  outgoing: TradeMarketCard[];
}

interface MutableCard {
  printingId: string;
  cardId: string;
  sources: Map<string, TradeMarketSource>;
  rows: TradeMarketRow[];
}

function collect(
  groups: readonly TradeMarketGroup[],
  trades: readonly CardTradeResponse[],
  direction: MatchDirection,
  dismissed: ReadonlySet<string>,
): Map<string, MutableCard> {
  const byPrinting = new Map<string, MutableCard>();
  for (const group of groups) {
    const rows = withoutLiveTradeMatches(
      direction === "incoming" ? group.incoming : group.outgoing,
      trades,
    ).filter(
      (row) =>
        !dismissed.has(
          dismissalKey({
            direction,
            counterpartyUserId: row.counterpartyUserId,
            printingId: row.printingId,
          }),
        ),
    );
    for (const row of rows) {
      let card = byPrinting.get(row.printingId);
      if (card === undefined) {
        card = { printingId: row.printingId, cardId: row.cardId, sources: new Map(), rows: [] };
        byPrinting.set(row.printingId, card);
      }
      card.rows.push({ ...row, groupSlug: group.slug });
      const source = card.sources.get(row.counterpartyUserId);
      if (source === undefined) {
        card.sources.set(row.counterpartyUserId, {
          userId: row.counterpartyUserId,
          name: row.counterpartyName,
          image: row.counterpartyImage,
          gravatarHash: row.counterpartyGravatarHash,
          groupNames: [group.name],
        });
      } else if (!source.groupNames.includes(group.name)) {
        source.groupNames.push(group.name);
      }
    }
  }
  return byPrinting;
}

function sourceUserIds(cards: Map<string, MutableCard>): Set<string> {
  const ids = new Set<string>();
  for (const card of cards.values()) {
    for (const userId of card.sources.keys()) {
      ids.add(userId);
    }
  }
  return ids;
}

function finish(
  cards: Map<string, MutableCard>,
  direction: MatchDirection,
  otherSide: Set<string>,
): TradeMarketCard[] {
  return [...cards.values()].map((card) => {
    const sources = [...card.sources.values()];
    return {
      direction,
      printingId: card.printingId,
      cardId: card.cardId,
      sources,
      rows: card.rows,
      swapUserIds: sources
        .filter((source) => otherSide.has(source.userId))
        .map((source) => source.userId),
    };
  });
}

/** One entry per printing and direction, pooled across groups; live trades already cover their rows. */
export function buildTradeMarket(
  groups: readonly TradeMarketGroup[],
  trades: readonly CardTradeResponse[],
  dismissed: ReadonlySet<string> = new Set(),
): TradeMarket {
  const incoming = collect(groups, trades, "incoming", dismissed);
  const outgoing = collect(groups, trades, "outgoing", dismissed);
  return {
    incoming: finish(incoming, "incoming", sourceUserIds(outgoing)),
    outgoing: finish(outgoing, "outgoing", sourceUserIds(incoming)),
  };
}

function narrowCard(
  card: TradeMarketCard,
  keep: (row: TradeMarketRow) => boolean,
): TradeMarketCard | null {
  const rows = card.rows.filter((row) => keep(row));
  if (rows.length === 0) {
    return null;
  }
  const userIds = new Set(rows.map((row) => row.counterpartyUserId));
  return {
    ...card,
    rows,
    sources: card.sources.filter((source) => userIds.has(source.userId)),
    swapUserIds: card.swapUserIds.filter((userId) => userIds.has(userId)),
  };
}

export function filterMarketByGroup(
  cards: readonly TradeMarketCard[],
  groupSlug: string | null,
): TradeMarketCard[] {
  if (groupSlug === null) {
    return [...cards];
  }
  return cards.flatMap((card) => {
    const narrowed = narrowCard(card, (row) => row.groupSlug === groupSlug);
    return narrowed === null ? [] : [narrowed];
  });
}

export function filterMarketByPerson(
  cards: readonly TradeMarketCard[],
  userId: string | null,
): TradeMarketCard[] {
  if (userId === null) {
    return [...cards];
  }
  return cards.flatMap((card) => {
    const narrowed = narrowCard(card, (row) => row.counterpartyUserId === userId);
    return narrowed === null ? [] : [narrowed];
  });
}

export interface TradeMarketPerson extends TradeMarketSource {
  cardCount: number;
}

export function marketPeople(market: TradeMarket): TradeMarketPerson[] {
  const byUser = new Map<string, TradeMarketPerson>();
  for (const card of [...market.incoming, ...market.outgoing]) {
    for (const source of card.sources) {
      const person = byUser.get(source.userId);
      if (person === undefined) {
        byUser.set(source.userId, { ...source, groupNames: [...source.groupNames], cardCount: 1 });
      } else {
        person.cardCount += 1;
      }
    }
  }
  return [...byUser.values()].toSorted(
    (a, b) => b.cardCount - a.cardCount || (a.name ?? "").localeCompare(b.name ?? ""),
  );
}

export function marketDismissals(market: TradeMarket, userId: string): TradeSuggestionDismissal[] {
  return [...market.incoming, ...market.outgoing].flatMap((card) =>
    card.sources.some((source) => source.userId === userId)
      ? [{ direction: card.direction, counterpartyUserId: userId, printingId: card.printingId }]
      : [],
  );
}

export function sortByValue<T>(
  items: readonly T[],
  valueOf: (item: T) => number | undefined,
  nameOf: (item: T) => string,
): T[] {
  return items.toSorted((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    if (left !== right) {
      if (left === undefined) {
        return 1;
      }
      if (right === undefined) {
        return -1;
      }
      return right - left;
    }
    return nameOf(a).localeCompare(nameOf(b));
  });
}
