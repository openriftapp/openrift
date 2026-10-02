import type { RuleKind, RuleLanguage } from "@openrift/shared/types/api/rules";

import { m } from "@/paraglide/messages.js";

export const VALID_RULE_KINDS: ReadonlySet<RuleKind> = new Set(["core", "tournament"]);

export function ruleKindTitle(kind: RuleKind, locale?: RuleLanguage): string {
  return kind === "tournament"
    ? m.rules_kind_tournament_title({}, { locale })
    : m.rules_kind_core_title({}, { locale });
}

export function ruleKindDescription(kind: RuleKind): string {
  return kind === "tournament"
    ? m.rules_seo_tournament_description()
    : m.rules_seo_core_description();
}

export function ruleVersionDescription(
  kind: RuleKind,
  version: string,
  locale: RuleLanguage,
): string {
  return kind === "tournament"
    ? m.rules_seo_tournament_version_description({ version }, { locale })
    : m.rules_seo_core_version_description({ version }, { locale });
}
