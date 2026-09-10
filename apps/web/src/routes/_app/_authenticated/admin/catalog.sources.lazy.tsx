import { createLazyFileRoute } from "@tanstack/react-router";

import { CatalogSourcesPage } from "@/features/catalog-admin/components/catalog-sources-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/catalog/sources")({
  component: CatalogSourcesPage,
});
