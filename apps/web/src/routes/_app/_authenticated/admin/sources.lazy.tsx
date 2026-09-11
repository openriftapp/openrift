import { createLazyFileRoute } from "@tanstack/react-router";

import { AdminSourcesPage } from "@/features/admin/components/admin-sources-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/sources")({
  component: AdminSourcesPage,
});
