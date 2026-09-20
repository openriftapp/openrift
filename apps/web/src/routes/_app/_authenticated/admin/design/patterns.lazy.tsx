import { createLazyFileRoute } from "@tanstack/react-router";

import { DesignPatternsPage } from "@/features/admin/components/design/patterns-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/design/patterns")({
  component: DesignPatternsPage,
});
