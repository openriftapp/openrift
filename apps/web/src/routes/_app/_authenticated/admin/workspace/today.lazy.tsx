import { createLazyFileRoute } from "@tanstack/react-router";

import { DecisionsPage } from "@/features/catalog-workspace/components/decisions-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/workspace/today")({
  component: DecisionsPage,
});
