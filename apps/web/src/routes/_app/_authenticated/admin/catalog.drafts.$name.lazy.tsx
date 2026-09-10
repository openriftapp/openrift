import { createLazyFileRoute, useParams } from "@tanstack/react-router";

import { DraftCardPage } from "@/features/catalog-admin/components/draft-card-page";

function DraftCardRoute() {
  const { name } = useParams({ from: "/_app/_authenticated/admin/catalog/drafts/$name" });
  return <DraftCardPage key={name} name={name} />;
}

export const Route = createLazyFileRoute("/_app/_authenticated/admin/catalog/drafts/$name")({
  component: DraftCardRoute,
});
