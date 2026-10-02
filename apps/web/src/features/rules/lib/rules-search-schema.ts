import { isRuleLanguage } from "@openrift/shared/rules";
import type { RuleLanguage } from "@openrift/shared/types/api/rules";

export interface RulesSearch {
  q?: string;
  lang?: RuleLanguage;
}

/** No zod: this schema runs in a route file, whose imports load on every page. */
export function rulesSearchSchema(search: Record<string, unknown>): RulesSearch {
  const result: RulesSearch = {};
  if (typeof search.q === "string" && search.q.trim() !== "") {
    result.q = search.q;
  }
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
