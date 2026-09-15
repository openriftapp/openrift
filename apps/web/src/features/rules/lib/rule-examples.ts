import { extractRuleRefs } from "@openrift/shared/board-state";
import type { FeaturedBoardStateResponse } from "@openrift/shared/types/api/board-state";
import type { RuleKind } from "@openrift/shared/types/api/rules";

export interface RuleExample {
  shareToken: string;
  title: string;
  answer: string | null;
}

function pinnedVersion(item: FeaturedBoardStateResponse, kind: RuleKind): string | null {
  return kind === "core" ? item.coreRulesVersion : item.tournamentRulesVersion;
}

/** Rule number -> board states pinned to `kind`/`version` that reference it. */
export function buildRuleExamplesMap(
  items: readonly FeaturedBoardStateResponse[],
  kind: RuleKind,
  version: string,
): Map<string, RuleExample[]> {
  const map = new Map<string, RuleExample[]>();
  for (const item of items) {
    if (pinnedVersion(item, kind) !== version) {
      continue;
    }
    const refs = new Set<string>();
    for (const ref of extractRuleRefs(item.answer ?? "")) {
      if (ref.kind === kind) {
        refs.add(ref.ruleNumber);
      }
    }
    for (const step of item.document.steps) {
      for (const ref of extractRuleRefs(step.caption)) {
        if (ref.kind === kind) {
          refs.add(ref.ruleNumber);
        }
      }
    }
    if (refs.size === 0) {
      continue;
    }
    const example: RuleExample = {
      shareToken: item.shareToken,
      title: item.title,
      answer: item.answer,
    };
    for (const ref of refs) {
      const existing = map.get(ref);
      if (existing) {
        existing.push(example);
      } else {
        map.set(ref, [example]);
      }
    }
  }
  return map;
}
