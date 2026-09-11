function rankOf(code: string, languageOrder: readonly string[]): number {
  const index = languageOrder.indexOf(code);
  return index === -1 ? languageOrder.length : index;
}

/** A language the admin list does not carry sorts last, so no printing falls out. */
export function groupPrintingsByLanguage<T extends { language: string }>(
  printings: readonly T[],
  languageOrder: readonly string[],
): [string, T[]][] {
  return [...Map.groupBy(printings, (printing) => printing.language)].toSorted(
    ([a], [b]) => rankOf(a, languageOrder) - rankOf(b, languageOrder) || a.localeCompare(b),
  );
}
