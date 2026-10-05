import { createLazyFileRoute } from "@tanstack/react-router";

import { OverlaySourcePage } from "@/features/stage/components/overlay-source-page";

export const Route = createLazyFileRoute("/stage_/source/$token")({
  component: OverlaySourcePage,
});
