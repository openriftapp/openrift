import type { CodeIndex, SearchablePrintingCodes } from "./card-search.js";
import { lookupCode } from "./card-search.js";
import type { DeckImportEntry } from "./deck-code.js";
import type { CardType, DeckZone, SuperType } from "./types/enums.js";
import { inferZone } from "./zone-inference.js";

export interface DeckCodeCard {
  types: readonly CardType[];
  superTypes: readonly SuperType[];
}

export interface ResolvedDeckCodeRow<TCard, TPrinting> {
  entry: DeckImportEntry;
  card: TCard;
  printing: TPrinting;
  zone: DeckZone;
}

export interface ResolvedDeckCode<TCard, TPrinting> {
  rows: ResolvedDeckCodeRow<TCard, TPrinting>[];
  unknownCodes: string[];
}

export function resolveDeckCodeEntries<
  TCard extends DeckCodeCard,
  TPrinting extends SearchablePrintingCodes,
>(
  entries: readonly DeckImportEntry[],
  codeIndex: CodeIndex<TCard, TPrinting>,
): ResolvedDeckCode<TCard, TPrinting> {
  const rows: ResolvedDeckCodeRow<TCard, TPrinting>[] = [];
  const unknownCodes: string[] = [];
  for (const entry of entries) {
    const match = entry.shortCode ? lookupCode(codeIndex, entry.shortCode) : undefined;
    if (!match) {
      if (entry.shortCode) {
        unknownCodes.push(entry.shortCode);
      }
      continue;
    }
    rows.push({
      entry,
      card: match.card,
      printing: match.printing,
      zone:
        entry.explicitZone ??
        inferZone(match.card.types, [...match.card.superTypes], entry.sourceSlot),
    });
  }
  return { rows, unknownCodes };
}
