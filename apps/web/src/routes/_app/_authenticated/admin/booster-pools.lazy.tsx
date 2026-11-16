import { createLazyFileRoute } from "@tanstack/react-router";

import { BoosterPoolsPage } from "@/features/admin/components/booster-pools-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/booster-pools")({
  component: BoosterPoolsPage,
});
