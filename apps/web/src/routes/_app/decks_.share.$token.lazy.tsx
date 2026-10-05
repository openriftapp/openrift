import { createLazyFileRoute } from "@tanstack/react-router";

import { SharedDeckPage } from "@/features/decks/components/shared-deck-page";

export const Route = createLazyFileRoute("/_app/decks_/share/$token")({
  component: SharedDeckPage,
});
