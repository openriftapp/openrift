import { createLazyFileRoute } from "@tanstack/react-router";

import { CardmarketOverlayPage } from "@/features/extension/components/cardmarket-overlay-page";

export const Route = createLazyFileRoute("/_app/_authenticated/extension/cardmarket")({
  component: CardmarketOverlayPage,
});
