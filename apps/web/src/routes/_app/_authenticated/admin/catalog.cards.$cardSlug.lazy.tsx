import { createLazyFileRoute, useParams } from "@tanstack/react-router";

import { CatalogCardPage } from "@/features/catalog-admin/components/catalog-card-page";

function CatalogCardRoute() {
  const { cardSlug } = useParams({
    from: "/_app/_authenticated/admin/catalog/cards/$cardSlug",
  });
  return <CatalogCardPage key={cardSlug} cardSlug={cardSlug} />;
}

export const Route = createLazyFileRoute("/_app/_authenticated/admin/catalog/cards/$cardSlug")({
  component: CatalogCardRoute,
});
