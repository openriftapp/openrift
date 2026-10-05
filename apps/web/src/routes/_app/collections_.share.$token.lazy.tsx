import { createLazyFileRoute } from "@tanstack/react-router";

import { SharedCollectionPage } from "@/features/collections/components/shared-collection-page";

export const Route = createLazyFileRoute("/_app/collections_/share/$token")({
  component: SharedCollectionPage,
});
