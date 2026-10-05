import { createLazyFileRoute } from "@tanstack/react-router";

import { PackOpenerPage } from "@/features/pack-opener/components/pack-opener-page";

export const Route = createLazyFileRoute("/_app/pack-opener")({
  component: PackOpenerPage,
});
