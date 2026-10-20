import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";

export function tradePrinting(
  trade: { cardId: string; printingId: string },
  printingsByCardId: ReadonlyMap<string, readonly Printing[]>,
  printingsById: Readonly<Record<string, Printing>>,
): Printing | undefined {
  return (
    printingsByCardId.get(trade.cardId)?.find((p) => p.printingId === trade.printingId) ??
    printingsById[trade.printingId]
  );
}

/** The side key that opens the trade's card in card detail. */
export function tradeSideKey(
  trade: { cardId: string; printingId: string },
  printingsByCardId: ReadonlyMap<string, readonly Printing[]>,
  printingsById: Readonly<Record<string, Printing>>,
): string {
  const printing = tradePrinting(trade, printingsByCardId, printingsById);
  return printing ? sideKey(printing) : trade.printingId;
}

/**
 * A member's match on `printing`, preferring the tile's card: a printing wish matches through
 * side 1's card, so a match for either card of the printing counts.
 */
export function matchOnPrinting<
  T extends { printingId: string; cardId: string; counterpartyUserId: string },
>(
  rows: readonly T[],
  printing: { printingId: string; cardId: string },
  counterpartyUserId: string,
): T | undefined {
  const onPrinting = rows.filter(
    (row) =>
      row.printingId === printing.printingId && row.counterpartyUserId === counterpartyUserId,
  );
  return onPrinting.find((row) => row.cardId === printing.cardId) ?? onPrinting[0];
}
