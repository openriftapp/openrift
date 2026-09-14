import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { sourcesQueryOptions } from "@/features/admin/lib/sources-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/sources")({
  head: () => adminSeoHead("Sources"),
  loader: async ({ context }) => {
    await context.queryClient.query({ ...sourcesQueryOptions, staleTime: "static" });
  },
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
