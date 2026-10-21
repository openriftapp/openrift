import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { workspaceSearchSchema } from "@/features/catalog-workspace/lib/workspace-search";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/workspace/cards")({
  head: () => adminSeoHead("Cards"),
  validateSearch: workspaceSearchSchema,
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
