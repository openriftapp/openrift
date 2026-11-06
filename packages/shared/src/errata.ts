import type { CardErrata } from "./types/catalog.js";

/** A printing in a language without its own errata shows its printed text, never another language's errata. */
export function errataForLanguage(
  errata: readonly CardErrata[],
  language: string,
): CardErrata | null {
  return errata.find((entry) => entry.language === language) ?? null;
}
