export function cardShareUrl(
  siteUrl: string,
  cardSlug: string,
  printingSlug?: string,
  side?: 2,
): string {
  const printingPath = printingSlug === undefined ? "" : `/${encodeURIComponent(printingSlug)}`;
  return `${siteUrl}/cards/${encodeURIComponent(cardSlug)}${printingPath}${side === 2 ? "?side=2" : ""}`;
}
