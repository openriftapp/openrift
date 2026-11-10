import { createLazyFileRoute } from "@tanstack/react-router";

import { CardDetailPage } from "@/features/cards/components/card-detail-page";
import { CardNotFound } from "@/features/cards/components/card-not-found";

export const Route = createLazyFileRoute("/_app/cards_/$cardSlug/{-$printingSlug}")({
  component: CardDetailPage,
  notFoundComponent: CardNotFound,
});
