import { createLazyFileRoute } from "@tanstack/react-router";

import { CollectionDetailPage } from "@/features/collections/components/collection-detail-page";

export const Route = createLazyFileRoute("/_app/_authenticated/collections/$collectionId")({
  component: CollectionDetailPage,
});
