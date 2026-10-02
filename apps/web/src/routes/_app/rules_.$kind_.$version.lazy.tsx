import type { RuleKind, RuleLanguage } from "@openrift/shared/types/api/rules";
import { createLazyFileRoute } from "@tanstack/react-router";

import { RulesPage } from "@/features/rules/components/rules-page";

export const Route = createLazyFileRoute("/_app/rules_/$kind_/$version")({
  component: RulesVersionPage,
});

function RulesVersionPage() {
  const { kind, language, version } = Route.useLoaderData() as {
    kind: RuleKind;
    language: RuleLanguage;
    version: string;
  };
  return <RulesPage kind={kind} language={language} version={version} />;
}
