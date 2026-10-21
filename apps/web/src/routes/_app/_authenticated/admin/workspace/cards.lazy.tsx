import { createLazyFileRoute } from "@tanstack/react-router";

import { CardsPage } from "@/features/catalog-workspace/components/cards-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/workspace/cards")({
  component: CardsPage,
});
