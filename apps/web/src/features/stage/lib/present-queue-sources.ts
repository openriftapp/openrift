import { sideKey } from "@openrift/shared/printing-side";
import type { DeckCardResponse } from "@openrift/shared/types/api/deck";
import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";

function preferredSideKey(
  cardId: string,
  pinnedId: string | null,
  printingsByCardId: Map<string, Printing[]>,
): string | null {
  const sides = printingsByCardId.get(cardId) ?? [];
  const pinned = pinnedId === null ? undefined : sides.find((p) => p.printingId === pinnedId);
  const printing = pinned ?? sides[0];
  return printing ? sideKey(printing) : null;
}

/** Quantity is ignored: a playset of three is one stop on the walk, not three. */
export function deckPrintingIds(
  cards: readonly DeckCardResponse[],
  printingsByCardId: Map<string, Printing[]>,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    const id = preferredSideKey(card.cardId, card.preferredPrintingId, printingsByCardId);
    if (id !== null && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function listPrintingIds(
  entries: readonly ListEntryDetailResponse[],
  printingsByCardId: Map<string, Printing[]>,
  printingsById: Record<string, Printing>,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const printing = entry.kind === "card" ? undefined : printingsById[entry.printingId];
    const id =
      entry.kind === "card"
        ? preferredSideKey(entry.cardId, null, printingsByCardId)
        : printing
          ? sideKey(printing)
          : null;
    if (id !== null && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}
