import { createLazyFileRoute } from "@tanstack/react-router";

import { ContributePrintingPickerPage } from "@/features/contribute/components/contribute-printing-picker-page";

export const Route = createLazyFileRoute("/_app/contribute_/printing")({
  component: ContributePrintingPickerPage,
});
