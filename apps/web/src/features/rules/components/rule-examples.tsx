import { formatRuleNumber } from "@openrift/shared/rules";
import { Link } from "@tanstack/react-router";
import { createContext, useContext } from "react";

import { CountPillButton } from "@/components/ui/count-pill";
import type { RuleExample } from "@/features/rules/lib/rule-examples";
import { useRulesPageStore } from "@/features/rules/stores/rules-page-store";
import { m } from "@/paraglide/messages.js";

export const RuleExamplesContext = createContext<ReadonlyMap<string, RuleExample[]>>(new Map());

export function RuleExamplesMarker({ ruleNumber }: { ruleNumber: string }) {
  const count = useContext(RuleExamplesContext).get(ruleNumber)?.length ?? 0;
  const isExpanded = useRulesPageStore((state) => state.expandedExamples.has(ruleNumber));
  const toggle = useRulesPageStore((state) => state.toggleExamples);

  if (count === 0) {
    return null;
  }

  return (
    <CountPillButton
      variant="primary"
      className="ml-2 align-baseline"
      aria-expanded={isExpanded}
      aria-label={
        isExpanded
          ? m.rules_examples_hide_aria({ rule: formatRuleNumber(ruleNumber) })
          : m.rules_examples_show_aria({ rule: formatRuleNumber(ruleNumber) })
      }
      onClick={() => toggle(ruleNumber)}
    >
      {m.rules_examples_count({ count })}
    </CountPillButton>
  );
}

export function RuleExamplesList({ ruleNumber }: { ruleNumber: string }) {
  const isExpanded = useRulesPageStore((state) => state.expandedExamples.has(ruleNumber));
  const examples = useContext(RuleExamplesContext).get(ruleNumber);

  if (!isExpanded || !examples || examples.length === 0) {
    return null;
  }

  return (
    <ul className="ml-6 flex flex-col gap-1 pb-2 text-sm">
      {examples.map((example) => (
        <li key={example.shareToken}>
          <Link
            to="/board/$token"
            params={{ token: example.shareToken }}
            className="font-medium hover:underline"
          >
            {example.title}
          </Link>
          {example.summary ? (
            <span className="text-muted-foreground ml-2">{example.summary}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
