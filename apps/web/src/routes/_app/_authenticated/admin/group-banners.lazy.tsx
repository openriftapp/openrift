import { createLazyFileRoute } from "@tanstack/react-router";

import { GroupBannersPage } from "@/features/admin/components/group-banners-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/group-banners")({
  component: GroupBannersPage,
});
