import { createLazyFileRoute } from "@tanstack/react-router";

import { ChangelogPage } from "@/features/marketing/components/changelog-page";

export const Route = createLazyFileRoute("/_app/changelog")({
  component: ChangelogRoute,
});

function ChangelogRoute() {
  const { show } = Route.useSearch();
  return <ChangelogPage view={show ?? "everything"} />;
}
