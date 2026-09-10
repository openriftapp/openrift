import { createLazyFileRoute } from "@tanstack/react-router";

import { CatalogCardsPage } from "@/features/catalog-admin/components/catalog-cards-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/catalog/cards/")({
  component: CatalogCardsPage,
});
