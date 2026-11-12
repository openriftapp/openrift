import type { CardNameParts } from "./card-name.js";
import { cardSearchAltNames, legendDisplayName } from "./card-name.js";
import type { CardSearchIndex, SearchablePrintingCodes } from "./card-search.js";
import { buildCardIndex } from "./card-search.js";

export interface LookupCardInput extends CardNameParts {
  id: string;
  slug: string;
}

export interface LookupPrintingInput extends SearchablePrintingCodes {
  cardId: string;
  printedName: string | null;
}

export type LookupRow<TCard> = TCard & { displayName: string; altNames: string[] };

function lookupRow<TCard extends LookupCardInput>(
  card: TCard,
  printedNames: readonly (string | null)[],
): LookupRow<TCard> {
  return {
    ...card,
    displayName: legendDisplayName(card),
    altNames: cardSearchAltNames(card, printedNames),
  };
}

export function buildCardLookupIndex<TCard extends LookupCardInput>(
  cards: Iterable<TCard>,
  printings: Iterable<LookupPrintingInput>,
): CardSearchIndex<LookupRow<TCard>> {
  const printingsByCardId = Map.groupBy(printings, (printing) => printing.cardId);
  const rows = [...cards].map((card) =>
    lookupRow(
      card,
      (printingsByCardId.get(card.id) ?? []).map((printing) => printing.printedName),
    ),
  );
  return buildCardIndex(rows, printingsByCardId);
}

export interface LookupPrintingRowInput extends LookupPrintingInput {
  card: CardNameParts;
}

export type PrintingLookupRow<TPrinting> = LookupRow<LookupCardInput & { printing: TPrinting }>;

export function buildPrintingLookupIndex<TPrinting extends LookupPrintingRowInput>(
  printings: readonly TPrinting[],
  rowKey: (printing: TPrinting) => { id: string; slug: string },
): CardSearchIndex<PrintingLookupRow<TPrinting>> {
  const rows: PrintingLookupRow<TPrinting>[] = [];
  const codesByRowId = new Map<string, SearchablePrintingCodes[]>();
  for (const printing of printings) {
    const { id, slug } = rowKey(printing);
    const { name, types, tags } = printing.card;
    rows.push(lookupRow({ id, slug, name, types, tags, printing }, [printing.printedName]));
    codesByRowId.set(id, [{ shortCode: printing.shortCode, publicCode: printing.publicCode }]);
  }
  return buildCardIndex(rows, codesByRowId);
}
