import { foldForSearch } from "@openrift/shared/search-fold";
import { looksLikeCardNumber } from "@openrift/shared/search-query/keys";
import { parseSearchQuery } from "@openrift/shared/search-query/parse";
import type { Printing } from "@openrift/shared/types/catalog";

type SearchAlternativeKind = "text" | "tag";

export interface SearchAlternative {
  kind: SearchAlternativeKind;
  query: string;
  label: string;
  count: number;
}

const ALTERNATIVE_KEYS: Record<SearchAlternativeKind, string> = { text: "o", tag: "tag" };

function plainWords(query: string): string[] | null {
  const { root } = parseSearchQuery(query);
  if (!root) {
    return null;
  }
  const terms = root.kind === "and" ? root.children : [root];
  const words: string[] = [];
  for (const term of terms) {
    if (term.kind !== "text") {
      return null;
    }
    words.push(term.value.replaceAll('"', ""));
  }
  if (words.every((word) => looksLikeCardNumber(word))) {
    return null;
  }
  return words;
}

function keyedQuery(key: string, words: readonly string[]): string {
  return words.map((word) => (/\s/u.test(word) ? `${key}:"${word}"` : `${key}:${word}`)).join(" ");
}

function tagLabel(words: readonly string[], matches: readonly Printing[]): string {
  const tags = [...new Set(matches.flatMap((printing) => printing.card.tags))];
  return words
    .map((word) => {
      const folded = foldForSearch(word);
      const exact = tags.find((tag) => foldForSearch(tag) === folded);
      const containing = tags.filter((tag) => foldForSearch(tag).includes(folded));
      return exact ?? (containing.length === 1 ? containing[0] : undefined) ?? word;
    })
    .join(" ");
}

/**
 * Card text and tag searches for a query of plain words, each kept only when it
 * finds a card the plain search did not. `count` is in cards, whatever the view.
 */
export function findSearchAlternatives(
  query: string,
  current: readonly Printing[],
  search: (query: string) => readonly Printing[],
): SearchAlternative[] {
  const words = plainWords(query);
  if (!words) {
    return [];
  }
  const shown = new Set(current.map((printing) => printing.cardId));
  const alternatives: SearchAlternative[] = [];
  for (const kind of ["text", "tag"] as const) {
    const alternativeQuery = keyedQuery(ALTERNATIVE_KEYS[kind], words);
    const matches = search(alternativeQuery);
    const cardIds = new Set(matches.map((printing) => printing.cardId));
    if (![...cardIds].some((cardId) => !shown.has(cardId))) {
      continue;
    }
    alternatives.push({
      kind,
      query: alternativeQuery,
      label: kind === "tag" ? tagLabel(words, matches) : words.join(" "),
      count: cardIds.size,
    });
  }
  return alternatives;
}
