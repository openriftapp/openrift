import { createLazyFileRoute } from "@tanstack/react-router";

import { SharedUserBundlePage } from "@/features/groups/components/shared-user-bundle-page";

export const Route = createLazyFileRoute("/_app/users_/share/$token")({
  component: SharedUserBundlePage,
});
