import { createLazyFileRoute } from "@tanstack/react-router";

import { SetDetailPage, SetDetailPending } from "@/features/cards/components/set-detail-page";

export const Route = createLazyFileRoute("/_app/sets_/$setSlug")({
  component: SetDetailPage,
  pendingComponent: SetDetailPending,
});
