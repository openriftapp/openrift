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
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...links];
  }
  return links.filter((row) =>
    [row.provider, row.externalId, row.shortCode, row.cardName].some((field) =>
      field.toLowerCase().includes(needle),
    ),
  );
}
