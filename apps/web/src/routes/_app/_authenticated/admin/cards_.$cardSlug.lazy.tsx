import { createLazyFileRoute } from "@tanstack/react-router";

import { ExistingCardPage } from "@/features/admin/components/existing-card-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/cards_/$cardSlug")({
  component: ExistingCardPage,
});
