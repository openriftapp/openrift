import type { DeckCheckEntryCardResponse } from "@openrift/shared/types/api/deck-check";
import type { Printing } from "@openrift/shared/types/catalog";

export function resolvedSide(
  card: Pick<DeckCheckEntryCardResponse, "resolvedCardId" | "resolvedPrintingId">,
  printingsById: Readonly<Record<string, Printing>>,
  printingsByCardId: ReadonlyMap<string, Printing[]>,
): Printing | undefined {
  if (card.resolvedPrintingId === null) {
    return undefined;
  }
  const side = card.resolvedCardId
    ? printingsByCardId
        .get(card.resolvedCardId)
        ?.find((printing) => printing.printingId === card.resolvedPrintingId)
    : undefined;
  return side ?? printingsById[card.resolvedPrintingId];
}
