import { createLazyFileRoute } from "@tanstack/react-router";

import { ContributeAddPrintingPage } from "@/features/contribute/components/contribute-add-printing-page";

export const Route = createLazyFileRoute(
  "/_app/_authenticated/contribute_/card_/$cardSlug_/printing",
)({
  component: ContributeAddPrintingPage,
});
