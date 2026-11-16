import { createLazyFileRoute } from "@tanstack/react-router";

import { InfractionsPage } from "@/features/rules/components/infractions-page";

export const Route = createLazyFileRoute("/_app/rules_/$kind_/$version_/infractions")({
  component: RulesInfractionsPage,
});

function RulesInfractionsPage() {
  const { language, version } = Route.useLoaderData();
  return <InfractionsPage language={language} version={version} />;
}
