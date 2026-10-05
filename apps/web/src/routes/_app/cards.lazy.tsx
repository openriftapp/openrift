import { createLazyFileRoute } from "@tanstack/react-router";

import { CardsPage } from "@/features/cards/components/cards-page";

export const Route = createLazyFileRoute("/_app/cards")({
  component: CardsPage,
});
