import { isRuleLanguage } from "@openrift/shared/rules";
import type { RulePenalty } from "@openrift/shared/rules-infractions";
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

export const PENALTY_SLUGS = {
  "no-penalty": "No Penalty",
  warning: "Warning",
  "game-loss": "Game Loss",
  "match-loss": "Match Loss",
  disqualification: "Disqualification",
} as const satisfies Record<string, RulePenalty>;

export type PenaltySlug = keyof typeof PENALTY_SLUGS;

export interface InfractionsSearch extends RulesSearch {
  penalty?: PenaltySlug;
}

export function penaltySlug(penalty: RulePenalty): PenaltySlug {
  return penalty.toLowerCase().replaceAll(" ", "-") as PenaltySlug;
}

function isPenaltySlug(value: unknown): value is PenaltySlug {
  return typeof value === "string" && Object.hasOwn(PENALTY_SLUGS, value);
}

export function infractionsSearchSchema(search: Record<string, unknown>): InfractionsSearch {
  const result: InfractionsSearch = rulesSearchSchema(search);
  if (isPenaltySlug(search.penalty)) {
    result.penalty = search.penalty;
  }
  return result;
}

export function defaultRuleLanguage(
  available: readonly RuleLanguage[],
  locale: string,
): RuleLanguage {
  return isRuleLanguage(locale) && available.includes(locale) ? locale : "en";
}
