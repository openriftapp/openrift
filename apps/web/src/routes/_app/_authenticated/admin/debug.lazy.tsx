import { createLazyFileRoute } from "@tanstack/react-router";

import { AdminDebugPage } from "@/features/admin/components/admin-debug-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/debug")({
  component: AdminDebugPage,
});
