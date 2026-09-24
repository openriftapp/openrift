import { createLazyFileRoute } from "@tanstack/react-router";

import { BuyPage } from "@/features/groups/components/buy-page";

export const Route = createLazyFileRoute("/_app/_authenticated/trades/buy")({
  component: BuyPage,
});
