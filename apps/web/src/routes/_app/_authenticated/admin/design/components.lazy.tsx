import { createLazyFileRoute } from "@tanstack/react-router";

import { DesignComponentsPage } from "@/features/admin/components/design/components-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/design/components")({
  component: DesignComponentsPage,
});
