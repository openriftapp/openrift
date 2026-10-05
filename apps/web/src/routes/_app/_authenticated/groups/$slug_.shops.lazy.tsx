import { createLazyFileRoute } from "@tanstack/react-router";

import { GroupShopEventsPage } from "@/features/groups/components/group-shop-events-page";

export const Route = createLazyFileRoute("/_app/_authenticated/groups/$slug_/shops")({
  component: GroupShopEventsPage,
});
