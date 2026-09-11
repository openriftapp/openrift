import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { unifiedMappingsQueryOptions } from "@/features/admin/hooks/use-unified-mappings";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/unmatched")({
  head: () => adminSeoHead("Unmatched products"),
  loader: async ({ context }) => {
    await context.queryClient.query({ ...unifiedMappingsQueryOptions(), staleTime: "static" });
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
