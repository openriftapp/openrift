import { createLazyFileRoute } from "@tanstack/react-router";

import { GroupSharedCollectionPage } from "@/features/groups/components/group-shared-collection-page";

export const Route = createLazyFileRoute(
  "/_app/_authenticated/groups/$slug_/collections/$collectionId",
)({
  component: GroupSharedCollectionPage,
});
