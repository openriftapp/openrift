import { createLazyFileRoute } from "@tanstack/react-router";

import { ContributeFixPickerPage } from "@/features/contribute/components/contribute-fix-picker-page";

export const Route = createLazyFileRoute("/_app/contribute_/fix")({
  component: ContributeFixPickerPage,
});
