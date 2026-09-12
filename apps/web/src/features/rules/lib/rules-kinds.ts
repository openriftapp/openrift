import type { RuleKind } from "@openrift/shared/types/api/rules";

import { m } from "@/paraglide/messages.js";

export const VALID_RULE_KINDS: ReadonlySet<RuleKind> = new Set(["core", "tournament"]);

export function ruleKindTitle(kind: RuleKind): string {
  return kind === "tournament" ? m.rules_kind_tournament_title() : m.rules_kind_core_title();
}
