import { cardTradeLivePhase } from "@openrift/shared/card-trade-lifecycle";
import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";
import type { ListDetailResponse } from "@openrift/shared/types/api/list";

export interface WantedEntryRef {
  listId: string;
  listName: string;
  entryId: string;
  spare: number;
}

export interface WantedCard {
  key: string;
  kind: "card" | "printing";
  cardId: string;
  printingId: string | null;
  quantity: number;
  ruleQuantity: number;
  listNames: string[];
  entries: WantedEntryRef[];
}

export interface OrderedCopy {
  printingId: string;
  cardId: string;
}

export function wantedCardKey(kind: "card" | "printing", id: string): string {
  return `${kind}:${id}`;
}

/**
 * Copies left per card on the printing. A double-sided copy is both of its cards, so a wish for
 * each card can count it; a printing wish uses the copy whole.
 */
interface Supply {
  printingId: string;
  remaining: Map<string, number>;
}

function supplyOf(printingId: string, cardIds: readonly string[], quantity: number): Supply {
  return { printingId, remaining: new Map(cardIds.map((cardId) => [cardId, quantity])) };
}

type CardIdsOfPrinting = (printingId: string) => readonly string[];

function isLiveIncoming(trade: CardTradeResponse): boolean {
  return trade.role === "receiver" && cardTradeLivePhase(trade) !== null;
}

function supplyCardIds(
  printingId: string,
  cardId: string,
  cardIdsOfPrinting: CardIdsOfPrinting,
): readonly string[] {
  const sides = cardIdsOfPrinting(printingId);
  return sides.includes(cardId) ? sides : [cardId, ...sides];
}

function tradeSupply(
  trades: readonly CardTradeResponse[],
  cardIdsOfPrinting: CardIdsOfPrinting,
): Supply[] {
  return trades
    .filter((trade) => isLiveIncoming(trade))
    .map((trade) =>
      supplyOf(
        trade.printingId,
        supplyCardIds(trade.printingId, trade.cardId, cardIdsOfPrinting),
        trade.quantity,
      ),
    );
}

function orderedSupply(
  copies: readonly OrderedCopy[],
  cardIdsOfPrinting: CardIdsOfPrinting,
): Supply[] {
  const byPrinting = new Map<string, Supply>();
  for (const copy of copies) {
    const supply = byPrinting.get(copy.printingId);
    if (supply === undefined) {
      byPrinting.set(
        copy.printingId,
        supplyOf(
          copy.printingId,
          supplyCardIds(copy.printingId, copy.cardId, cardIdsOfPrinting),
          1,
        ),
      );
    } else {
      for (const [cardId, count] of supply.remaining) {
        supply.remaining.set(cardId, count + 1);
      }
    }
  }
  return [...byPrinting.values()];
}

function reservedByEntry(trades: readonly CardTradeResponse[]): Map<string, number> {
  const reserved = new Map<string, number>();
  for (const trade of trades) {
    if (isLiveIncoming(trade) && trade.viewerWishEntryId !== null) {
      reserved.set(
        trade.viewerWishEntryId,
        (reserved.get(trade.viewerWishEntryId) ?? 0) + trade.quantity,
      );
    }
  }
  return reserved;
}

function take(wanted: WantedCard, supply: Supply[], max: number): number {
  let left = max;
  for (const item of supply) {
    if (left <= 0) {
      break;
    }
    if (wanted.kind === "printing") {
      if (item.printingId !== wanted.printingId) {
        continue;
      }
      const taken = Math.min(left, ...item.remaining.values());
      for (const [cardId, count] of item.remaining) {
        item.remaining.set(cardId, count - taken);
      }
      left -= taken;
    } else {
      const available = item.remaining.get(wanted.cardId);
      if (available === undefined) {
        continue;
      }
      const taken = Math.min(left, available);
      item.remaining.set(wanted.cardId, available - taken);
      left -= taken;
    }
  }
  return max - left;
}

/**
 * Every card the viewer's wish lists still ask for, summed across lists and
 * netted against live incoming trades, with rule-added wants also netted against ordered copies.
 */
export function buildWantedCards(
  details: readonly ListDetailResponse[],
  trades: readonly CardTradeResponse[],
  cardIdsOfPrinting: CardIdsOfPrinting,
  orderedCopies: readonly OrderedCopy[] = [],
): WantedCard[] {
  const reserved = reservedByEntry(trades);
  const byKey = new Map<string, WantedCard>();
  for (const detail of details) {
    for (const entry of detail.entries) {
      if (entry.kind === "copy") {
        continue;
      }
      const cardId = entry.kind === "card" ? entry.cardId : cardIdsOfPrinting(entry.printingId)[0];
      if (cardId === undefined) {
        continue;
      }
      const key =
        entry.kind === "card"
          ? wantedCardKey("card", entry.cardId)
          : wantedCardKey("printing", entry.printingId);
      let wanted = byKey.get(key);
      if (wanted === undefined) {
        wanted = {
          key,
          kind: entry.kind,
          cardId,
          printingId: entry.kind === "printing" ? entry.printingId : null,
          quantity: 0,
          ruleQuantity: 0,
          listNames: [],
          entries: [],
        };
        byKey.set(key, wanted);
      }
      wanted.quantity += entry.quantity;
      wanted.ruleQuantity += entry.ruleQuantity;
      if (!wanted.listNames.includes(detail.list.name)) {
        wanted.listNames.push(detail.list.name);
      }
      const spare =
        entry.id === null ? 0 : entry.quantity - entry.ruleQuantity - (reserved.get(entry.id) ?? 0);
      if (entry.id !== null && spare > 0) {
        wanted.entries.push({
          listId: detail.list.id,
          listName: detail.list.name,
          entryId: entry.id,
          spare,
        });
      }
    }
  }

  const incoming = tradeSupply(trades, cardIdsOfPrinting);
  const ordered = orderedSupply(orderedCopies, cardIdsOfPrinting);
  const printingFirst = [...byKey.values()].toSorted(
    (a, b) => Number(a.kind === "card") - Number(b.kind === "card"),
  );
  const netted = new Map<string, number>();
  for (const wanted of printingFirst) {
    const afterTrades = wanted.quantity - take(wanted, incoming, wanted.quantity);
    const ruleLeft = Math.min(wanted.ruleQuantity, afterTrades);
    netted.set(wanted.key, afterTrades - take(wanted, ordered, ruleLeft));
  }
  const result: WantedCard[] = [];
  for (const wanted of byKey.values()) {
    const quantity = netted.get(wanted.key) ?? 0;
    if (quantity > 0) {
      result.push({ ...wanted, quantity });
    }
  }
  return result;
}

export function wantedMatchesPrinting(
  wanted: Pick<WantedCard, "kind" | "cardId" | "printingId">,
  cardId: string,
  printingId: string,
): boolean {
  return wanted.kind === "card" ? wanted.cardId === cardId : wanted.printingId === printingId;
}

export interface WishDecrement {
  entryId: string;
  by: number;
}

export function wishDecrements(
  entries: readonly WantedEntryRef[],
  received: number,
): WishDecrement[] {
  const decrements: WishDecrement[] = [];
  let left = received;
  for (const entry of entries) {
    if (left <= 0) {
      break;
    }
    const by = Math.min(entry.spare, left);
    left -= by;
    decrements.push({ entryId: entry.entryId, by });
  }
  return decrements;
}
