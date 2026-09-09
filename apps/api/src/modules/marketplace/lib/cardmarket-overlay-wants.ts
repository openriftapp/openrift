import type { ListEntryRow } from "../../lists/repositories/lists-shared.js";
import type { CardmarketOverlayWant } from "../repositories/cardmarket-overlay.js";

/** Copy-kind rows carry the copy's own `printingId`, so a want is always a card or a printing target. */
export function overlayWantsFromEntries(entries: ListEntryRow[]): CardmarketOverlayWant[] {
  return entries.map((entry) =>
    entry.kind === "card"
      ? { cardId: entry.cardId, printingId: null, quantity: entry.quantity }
      : { cardId: null, printingId: entry.printingId, quantity: entry.quantity },
  );
}
