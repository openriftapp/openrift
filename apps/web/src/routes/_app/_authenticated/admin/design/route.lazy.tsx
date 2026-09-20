import { createLazyFileRoute } from "@tanstack/react-router";

import { DesignLayout } from "@/features/admin/components/design/design-layout";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/design")({
  component: DesignLayout,
});
