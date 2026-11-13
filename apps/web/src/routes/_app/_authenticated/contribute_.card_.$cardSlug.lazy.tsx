import { createLazyFileRoute } from "@tanstack/react-router";

import { ContributeCorrectionPage } from "@/features/contribute/components/contribute-correction-page";

export const Route = createLazyFileRoute("/_app/_authenticated/contribute_/card_/$cardSlug")({
  component: ContributeCorrectionPage,
});
