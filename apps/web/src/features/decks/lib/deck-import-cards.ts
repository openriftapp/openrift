import { mergeDeckCards } from "@openrift/shared/deck-cards";
import type { DeckZone } from "@openrift/shared/types/enums";

import { m } from "@/paraglide/messages.js";

export function defaultImportDeckName(): string {
  return m.decks_import_default_deck_name();
}

/** The shape both the server save-cards mutation and the local-decks store accept. */
export interface ImportedDeckCard {
  cardId: string;
  zone: DeckZone;
  quantity: number;
  preferredPrintingId: string | null;
}

interface MatchedEntryLike {
  zone: DeckZone;
  entry: { quantity: number };
  resolvedCard: { cardId: string; preferredPrintingId: string | null } | null;
}

export function dedupeMatchedEntries(entries: readonly MatchedEntryLike[]): ImportedDeckCard[] {
  return mergeDeckCards(
    entries.flatMap((entry) =>
      entry.resolvedCard
        ? [
            {
              cardId: entry.resolvedCard.cardId,
              zone: entry.zone,
              quantity: entry.entry.quantity,
              preferredPrintingId: entry.resolvedCard.preferredPrintingId,
            },
          ]
        : [],
    ),
  );
}
