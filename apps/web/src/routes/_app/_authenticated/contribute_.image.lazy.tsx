import { createLazyFileRoute } from "@tanstack/react-router";

import { ContributeImagePickerPage } from "@/features/contribute/components/contribute-image-picker-page";

export const Route = createLazyFileRoute("/_app/_authenticated/contribute_/image")({
  component: ContributeImagePickerPage,
});
