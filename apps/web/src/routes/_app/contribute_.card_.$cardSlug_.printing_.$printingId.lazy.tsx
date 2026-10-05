import { createLazyFileRoute } from "@tanstack/react-router";

import { ContributePrintingCorrectionPage } from "@/features/contribute/components/contribute-printing-correction-page";

export const Route = createLazyFileRoute(
  "/_app/contribute_/card_/$cardSlug_/printing_/$printingId",
)({
  component: ContributePrintingCorrectionPage,
});
