import { cardSearchAltNames } from "@openrift/shared/card-name";
import { buildCardIndex, resolveCard } from "@openrift/shared/card-search";
import { parseDeckImportData } from "@openrift/shared/deck-codecs/parse";

export interface MinimalCard {
  id: string;
  name: string;
  types: string[];
  tags: string[];
  shortCodes?: readonly string[];
}

export interface BulkImportPlan {
  cardIds: string[];
  matched: { cardId: string; name: string }[];
  unmatched: string[];
  ambiguous: { name: string; matches: { cardId: string; name: string }[] }[];
  warnings: string[];
}

/**
 * Reuses the deck importer's text parser and `resolveCard`, so a card
 * resolvable in the deck importer also resolves here.
 */
export function planCustomTagBulkImport(text: string, allCards: MinimalCard[]): BulkImportPlan {
  const { entries, warnings } = parseDeckImportData(text, "text");

  const byShortCode = new Map<string, MinimalCard>();
  for (const card of allCards) {
    for (const shortCode of card.shortCodes ?? []) {
      byShortCode.set(shortCode.toLowerCase(), card);
    }
  }
  const nameIndex = buildCardIndex(
    allCards.map((card) => ({ ...card, slug: card.id, altNames: cardSearchAltNames(card) })),
    new Map(),
  );

  const matched: { cardId: string; name: string }[] = [];
  const seenIds = new Set<string>();
  const unmatched: string[] = [];
  const ambiguous: BulkImportPlan["ambiguous"] = [];

  for (const entry of entries) {
    const name = entry.cardName;
    if (!name) {
      continue;
    }
    let card = entry.shortCode ? byShortCode.get(entry.shortCode.toLowerCase()) : undefined;
    if (card === undefined) {
      const resolution = resolveCard(nameIndex, name);
      if (resolution.status === "unmatched") {
        unmatched.push(name);
        continue;
      }
      if (resolution.status === "ambiguous") {
        ambiguous.push({
          name,
          matches: resolution.candidates.map((hit) => ({ cardId: hit.id, name: hit.name })),
        });
        continue;
      }
      card = resolution.card;
    }
    if (!seenIds.has(card.id)) {
      seenIds.add(card.id);
      matched.push({ cardId: card.id, name: card.name });
    }
  }

  return {
    cardIds: matched.map((m) => m.cardId),
    matched,
    unmatched,
    ambiguous,
    warnings,
  };
}
