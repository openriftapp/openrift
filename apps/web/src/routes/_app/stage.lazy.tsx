import { createLazyFileRoute } from "@tanstack/react-router";

import { StagePage } from "@/features/stage/components/stage-page";

export const Route = createLazyFileRoute("/_app/stage")({
  component: StagePage,
});
