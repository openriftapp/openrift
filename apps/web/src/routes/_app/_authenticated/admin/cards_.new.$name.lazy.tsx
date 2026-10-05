import { createLazyFileRoute } from "@tanstack/react-router";

import { NewCardDetailPage } from "@/features/admin/components/new-card-detail-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/cards_/new/$name")({
  component: NewCardDetailPage,
});
