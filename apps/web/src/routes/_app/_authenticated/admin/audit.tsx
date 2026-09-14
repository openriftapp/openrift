import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { auditEventsQueryOptions } from "@/features/admin/lib/admin-audit-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/audit")({
  head: () => adminSeoHead("Audit Log"),
  loader: ({ context }) =>
    context.queryClient.infiniteQuery({ ...auditEventsQueryOptions(), staleTime: "static" }),
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
