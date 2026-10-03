import type { RuleRef, RuleRefKind } from "@openrift/shared/board-state";
import { useQuery } from "@tanstack/react-query";

import { ruleNumbersQueryOptions } from "@/features/rules/lib/rules-queries";

/** Rule numbers in each pinned version; a kind that is absent has not loaded yet. */
export type KnownRules = Partial<Record<RuleRefKind, ReadonlySet<string>>>;

interface RulesPins {
  coreRulesVersion: string | null;
  tournamentRulesVersion: string | null;
}

function useKnownNumbers(kind: RuleRefKind, version: string | null) {
  return useQuery({
    ...ruleNumbersQueryOptions(kind, version ?? ""),
    enabled: version !== null,
  }).data;
}

/** Rule numbers of the pinned versions; a kind stays absent until it loads, so its chips keep linking. */
export function useKnownRules(pins: RulesPins): KnownRules {
  const core = useKnownNumbers("core", pins.coreRulesVersion);
  const tournament = useKnownNumbers("tournament", pins.tournamentRulesVersion);
  return {
    ...(core === undefined ? {} : { core }),
    ...(tournament === undefined ? {} : { tournament }),
  };
}

/** References that point at a pinned version that is loaded and lacks them. */
export function unknownRuleRefs(refs: readonly RuleRef[], known: KnownRules): RuleRef[] {
  return refs.filter((ref) => known[ref.kind]?.has(ref.ruleNumber) === false);
}
