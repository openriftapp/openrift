import { createLazyFileRoute } from "@tanstack/react-router";

import { StageShowPage } from "@/features/stage/components/stage-show-page";

export const Route = createLazyFileRoute("/_app/stage_/show")({
  component: StageShowPage,
});
