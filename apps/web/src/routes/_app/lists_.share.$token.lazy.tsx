import { createLazyFileRoute } from "@tanstack/react-router";

import { SharedListPage } from "@/features/lists/components/shared-list-page";

export const Route = createLazyFileRoute("/_app/lists_/share/$token")({
  component: SharedListPage,
});
