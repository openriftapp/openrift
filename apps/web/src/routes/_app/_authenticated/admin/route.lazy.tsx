import { createLazyFileRoute } from "@tanstack/react-router";

import { AdminLayout } from "@/features/admin/components/admin-layout";

export const Route = createLazyFileRoute("/_app/_authenticated/admin")({
  component: AdminLayout,
});
