import { isRuleLanguage } from "@openrift/shared/rules";
import type { RuleLanguage } from "@openrift/shared/types/api/rules";

export interface RulesSearch {
  q?: string;
  lang?: RuleLanguage;
}

/** No zod: these schemas run in route files, whose imports load on every page. */
export function querySearchSchema(search: Record<string, unknown>): { q?: string } {
  return typeof search.q === "string" && search.q.trim() !== "" ? { q: search.q } : {};
}

export function rulesSearchSchema(search: Record<string, unknown>): RulesSearch {
  const result: RulesSearch = querySearchSchema(search);
  if (isRuleLanguage(search.lang)) {
    result.lang = search.lang;
  }
  return result;
}

export function defaultRuleLanguage(
  available: readonly RuleLanguage[],
  locale: string,
): RuleLanguage {
  return isRuleLanguage(locale) && available.includes(locale) ? locale : "en";
}
