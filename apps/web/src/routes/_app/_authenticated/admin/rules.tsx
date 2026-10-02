import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminRuleVersionsQueryOptions } from "@/features/rules/lib/admin-rule-versions-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/rules")({
  head: () => adminSeoHead("Rules"),
  loader: ({ context }) =>
    context.queryClient.query({ ...adminRuleVersionsQueryOptions(), staleTime: "static" }),
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
