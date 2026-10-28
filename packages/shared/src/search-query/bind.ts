import type { SearchKeyId } from "./keys.js";
import type { ParsedSearchQuery, SearchDiagnostic } from "./parse.js";

export type SearchVocabulary = Partial<Record<SearchKeyId, readonly string[]>>;

export function bindSearchQuery(
  parsed: ParsedSearchQuery,
  vocabulary: SearchVocabulary,
  unsupportedKeys: readonly SearchKeyId[] = [],
): SearchDiagnostic[] {
  const diagnostics: SearchDiagnostic[] = [];
  for (const clause of parsed.clauses) {
    if (unsupportedKeys.includes(clause.key)) {
      diagnostics.push({
        code: "unsupportedKey",
        severity: "error",
        span: clause.span,
        key: clause.key,
        value: clause.value,
      });
      continue;
    }
    const known = vocabulary[clause.key];
    const values = clause.value.split(",");
    if (known && !values.every((value) => known.some((slug) => slug.toLowerCase() === value))) {
      diagnostics.push({
        code: "unknownValue",
        severity: "warning",
        span: clause.span,
        key: clause.key,
        value: clause.value,
      });
    }
  }
  return diagnostics;
}
