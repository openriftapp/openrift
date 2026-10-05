import { matchesTextQuery } from "@openrift/shared/search-fold";

export interface PrintingLinkRow {
  provider: string;
  externalId: string;
  shortCode: string;
  cardName: string;
}

export function filterPrintingLinks<T extends PrintingLinkRow>(
  links: readonly T[],
  query: string,
): T[] {
  return links.filter((row) =>
    matchesTextQuery(query, [row.provider, row.externalId, row.shortCode, row.cardName]),
  );
}
