import { createLazyFileRoute } from "@tanstack/react-router";

import { GroupSharedListPage } from "@/features/groups/components/group-shared-list-page";

export const Route = createLazyFileRoute("/_app/_authenticated/groups/$slug_/lists/$listId")({
  component: GroupSharedListPage,
});
