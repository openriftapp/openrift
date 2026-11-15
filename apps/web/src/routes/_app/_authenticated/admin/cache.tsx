import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminCacheStatusQueryOptions } from "@/features/admin/lib/cache-purge-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/cache")({
  head: () => adminSeoHead("Cache"),
  loader: ({ context }) =>
    context.queryClient.query({ ...adminCacheStatusQueryOptions, staleTime: "static" }),
  pendingComponent: AdminPending,
});
