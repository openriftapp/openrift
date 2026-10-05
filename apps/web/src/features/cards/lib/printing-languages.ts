export interface PrintingLanguageGroup<T extends { language: string }> {
  language: string;
  printings: T[];
}

/**
 * Without `languageOrder` the groups keep input order. With it, languages the order
 * does not know are appended alphabetically, not dropped: dropping one would make its printings unreachable.
 */
export function groupPrintingsByLanguage<T extends { language: string }>(
  printings: readonly T[],
  languageOrder?: readonly string[],
): PrintingLanguageGroup<T>[] {
  const byLanguage = Map.groupBy(printings, (printing) => printing.language);

  if (!languageOrder) {
    return [...byLanguage].map(([language, group]) => ({ language, printings: group }));
  }

  const known = languageOrder.filter((code) => byLanguage.has(code));
  const unknown = [...byLanguage.keys()]
    .filter((code) => !known.includes(code))
    .toSorted((a, b) => a.localeCompare(b));
  return [...known, ...unknown].map((language) => ({
    language,
    printings: byLanguage.get(language) ?? [],
  }));
}
