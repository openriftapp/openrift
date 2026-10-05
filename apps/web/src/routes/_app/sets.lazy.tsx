import { createLazyFileRoute } from "@tanstack/react-router";

import { SetsPage, SetsPending } from "@/features/cards/components/sets-page";

export const Route = createLazyFileRoute("/_app/sets")({
  component: SetsPage,
  pendingComponent: SetsPending,
});
