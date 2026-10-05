import type { Printing } from "./types/catalog.js";

export function sortByLanguageAndCanonicalRank(
  printings: readonly Printing[],
  languageOrder: readonly string[],
): Printing[] {
  const rankByLang = new Map(languageOrder.map((lang, i) => [lang, i]));
  const unlistedRank = languageOrder.length;
  return printings.toSorted((a, b) => {
    const aRank = rankByLang.get(a.language) ?? unlistedRank;
    const bRank = rankByLang.get(b.language) ?? unlistedRank;
    return aRank - bRank || a.canonicalRank - b.canonicalRank;
  });
}

// languageOrder must be the caller's effective order (user preference, or
// languages.sort_order); this function has no hardcoded fallback.
export function compareWithLanguagePreference(
  a: Printing,
  b: Printing,
  languageOrder: readonly string[],
): number {
  const aIdx = languageOrder.indexOf(a.language);
  const bIdx = languageOrder.indexOf(b.language);
  const aPos = aIdx === -1 ? languageOrder.length : aIdx;
  const bPos = bIdx === -1 ? languageOrder.length : bIdx;
  const langCompare = aPos - bPos;
  if (langCompare !== 0) {
    return langCompare;
  }
  if (aIdx === -1 && bIdx === -1) {
    const alphaCompare = a.language.localeCompare(b.language);
    if (alphaCompare !== 0) {
      return alphaCompare;
    }
  }
  return a.canonicalRank - b.canonicalRank;
}

export function deduplicateByCard(
  printings: Printing[],
  languageOrder: readonly string[],
): Printing[] {
  const seen = new Map<string, Printing>();
  for (const printing of printings) {
    const existing = seen.get(printing.cardId);
    if (existing) {
      if (compareWithLanguagePreference(printing, existing, languageOrder) < 0) {
        seen.set(printing.cardId, printing);
      }
    } else {
      seen.set(printing.cardId, printing);
    }
  }
  return [...seen.values()];
}

export function preferredPrinting(
  printings: Printing[],
  languageOrder: readonly string[],
): Printing | undefined {
  let best: Printing | undefined;
  for (const printing of printings) {
    if (best === undefined || compareWithLanguagePreference(printing, best, languageOrder) < 0) {
      best = printing;
    }
  }
  return best;
}
