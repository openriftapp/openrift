export function skuKey(externalId: number, finish: string, language: string | null): string {
  return `${externalId}::${finish}::${language ?? ""}`;
}

export function marketplaceSkuKey(
  marketplace: string,
  externalId: number,
  finish: string,
  language: string | null,
): string {
  return `${marketplace}::${skuKey(externalId, finish, language)}`;
}
