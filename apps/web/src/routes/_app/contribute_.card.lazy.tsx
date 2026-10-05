import { createLazyFileRoute } from "@tanstack/react-router";

import { ContributeCardPage } from "@/features/contribute/components/contribute-card-page";

export const Route = createLazyFileRoute("/_app/contribute_/card")({
  component: ContributeCardPage,
});
