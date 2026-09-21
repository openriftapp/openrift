import type { KeywordsResponse } from "@openrift/shared/types/api/keyword";
import { useSuspenseQuery } from "@tanstack/react-query";

import { initQueryOptions } from "@/lib/init-queries";

export function useKeywordStyles(): KeywordsResponse["items"] {
  const { data } = useSuspenseQuery(initQueryOptions);
  return data.keywords as KeywordsResponse["items"];
}

export function useCardModifierKeywords(): { name: string; color: string; darkText: boolean }[] {
  const keywordStyles = useKeywordStyles();
  return Object.entries(keywordStyles)
    .filter(([, entry]) => entry.cardModifier)
    .map(([name, entry]) => ({ name, color: entry.color, darkText: entry.darkText }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

export function useCostKeywords(): string[] {
  const keywordStyles = useKeywordStyles();
  return Object.entries(keywordStyles)
    .filter(([, entry]) => entry.costKeyword)
    .map(([name]) => name);
}
