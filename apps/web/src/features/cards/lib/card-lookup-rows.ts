import type { LookupCardInput, LookupRow, PrintingLookupRow } from "@openrift/shared/card-lookup";
import { buildCardLookupIndex, buildPrintingLookupIndex } from "@openrift/shared/card-lookup";
import type { CardSearchIndex } from "@openrift/shared/card-search";
import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";

export type PrintingSearchRow = PrintingLookupRow<Printing>;

export type CardSearchRow = LookupRow<
  LookupCardInput & { printing: Printing; printings: Printing[] }
>;

export function printingLookupIndex(
  printings: readonly Printing[],
): CardSearchIndex<PrintingSearchRow> {
  return buildPrintingLookupIndex(printings, (printing) => ({
    id: sideKey(printing),
    slug: printing.shortCode,
  }));
}

export function cardLookupIndex(printings: Iterable<Printing>): CardSearchIndex<CardSearchRow> {
  const byCard = Map.groupBy(printings, (printing) => printing.cardId);
  const cards: (LookupCardInput & { printing: Printing; printings: Printing[] })[] = [];
  for (const [cardId, cardPrintings] of byCard) {
    const first = cardPrintings[0];
    if (first) {
      const { name, types, tags } = first.card;
      cards.push({
        id: cardId,
        slug: cardId,
        name,
        types,
        tags,
        printing: first,
        printings: cardPrintings,
      });
    }
  }
  return buildCardLookupIndex(cards, [...byCard.values()].flat());
}

export function shownPrintingHits(
  hits: readonly PrintingSearchRow[],
  shownByCardId: ReadonlyMap<string, readonly Printing[]>,
): Printing[] {
  const seen = new Set<string>();
  const out: Printing[] = [];
  for (const { printing } of hits) {
    const shown = shownByCardId.get(printing.cardId) ?? [];
    const candidates = shown.includes(printing) ? [printing] : shown;
    for (const candidate of candidates) {
      const key = sideKey(candidate);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(candidate);
      }
    }
  }
  return out;
}
