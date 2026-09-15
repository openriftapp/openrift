import { Link } from "@tanstack/react-router";

import { CountPillButton } from "@/components/ui/count-pill";
import { useRuleExamplesStore } from "@/features/rules/stores/rule-examples-store";
import { m } from "@/paraglide/messages.js";

import { formatRuleNumber } from "./rule-content";

export function RuleExamplesMarker({ ruleNumber }: { ruleNumber: string }) {
  const count = useRuleExamplesStore((state) => state.examplesByRule.get(ruleNumber)?.length ?? 0);
  const isExpanded = useRuleExamplesStore((state) => state.expandedRules.has(ruleNumber));
  const toggle = useRuleExamplesStore((state) => state.toggle);

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
  const isExpanded = useRuleExamplesStore((state) => state.expandedRules.has(ruleNumber));
  const examples = useRuleExamplesStore((state) => state.examplesByRule.get(ruleNumber));

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
          {example.answer ? (
            <span className="text-muted-foreground ml-2">{example.answer}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
