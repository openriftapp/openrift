import { parsePiltoverDeckCode } from "@openrift/shared/deck-code";
import { parseDeckImportData } from "@openrift/shared/deck-codecs/parse";
import { WellKnown } from "@openrift/shared/well-known";

interface ManualEntryCard {
  name: string;
  quantity: number;
  section: string;
}

export interface ParsedManualDecklist {
  cards: ManualEntryCard[];
  totalCopies: number;
  warnings: string[];
}

/**
 * Parses the same text format the deck importer accepts. Lines without a zone
 * header fall back to the main deck; identical name+zone lines are merged.
 */
export function parseManualDecklist(text: string): ParsedManualDecklist {
  const { entries, warnings } = parseDeckImportData(text, "text");

  const merged = new Map<string, ManualEntryCard>();
  for (const entry of entries) {
    const name = entry.cardName?.trim();
    if (!name) {
      continue;
    }
    const section = entry.explicitZone ?? WellKnown.deckZone.MAIN;
    const key = `${name.toLowerCase()}|${section}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += entry.quantity;
    } else {
      merged.set(key, { name, quantity: entry.quantity, section });
    }
  }

  const cards = [...merged.values()];
  const totalCopies = cards.reduce((sum, card) => sum + card.quantity, 0);
  return { cards, totalCopies, warnings };
}

export type DeckPaste =
  | { kind: "code"; deckCode: string; totalCopies: number; warnings: string[] }
  | ({ kind: "list" } & ParsedManualDecklist);

export function parseDeckPaste(text: string): DeckPaste {
  const trimmed = text.trim();
  if (trimmed.length > 0 && !/\s/u.test(trimmed)) {
    const { entries, warnings } = parsePiltoverDeckCode(trimmed);
    const totalCopies = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    return { kind: "code", deckCode: trimmed, totalCopies, warnings };
  }
  return { kind: "list", ...parseManualDecklist(trimmed) };
}
