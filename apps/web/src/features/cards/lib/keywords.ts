import { keywordReverseMap } from "@openrift/shared/keywords";
import { foldForSearch } from "@openrift/shared/search-fold";
import type { KeywordsResponse } from "@openrift/shared/types/api/keyword";

const FALLBACK_COLOR = "#6a6a6a";

export function buildTranslationReverseMap(styles: KeywordsResponse["items"]): Map<string, string> {
  return keywordReverseMap(
    Object.entries(styles).flatMap(([keywordName, entry]) =>
      Object.values(entry.translations ?? {}).map((label) => ({ keywordName, label })),
    ),
  );
}

function resolveKeywordCanonical(keyword: string, reverseMap: Map<string, string>): string {
  return reverseMap.get(foldForSearch(keyword)) ?? keyword;
}

export function getKeywordStyle(
  keyword: string,
  styles: KeywordsResponse["items"],
  reverseMap?: Map<string, string>,
): { bg: string; dark: boolean } {
  const base = keyword.replace(/\s+\d+$/u, "");
  const entry =
    styles[base] ?? (reverseMap ? styles[resolveKeywordCanonical(base, reverseMap)] : undefined);
  return {
    bg: entry?.color ?? FALLBACK_COLOR,
    dark: entry?.darkText ?? false,
  };
}
