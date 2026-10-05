import { createLazyFileRoute } from "@tanstack/react-router";

import { ContributeCorrectionPage } from "@/features/contribute/components/contribute-correction-page";

export const Route = createLazyFileRoute("/_app/contribute_/card_/$cardSlug")({
  component: ContributeCorrectionPage,
});
