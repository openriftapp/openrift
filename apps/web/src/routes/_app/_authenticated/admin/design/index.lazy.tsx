import { createLazyFileRoute } from "@tanstack/react-router";

import { DesignFoundationsPage } from "@/features/admin/components/design/foundations-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/design/")({
  component: DesignFoundationsPage,
});
