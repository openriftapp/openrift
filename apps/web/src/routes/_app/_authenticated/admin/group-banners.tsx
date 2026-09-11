import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { groupBannersQueryOptions } from "@/features/admin/hooks/use-group-banners";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/group-banners")({
  head: () => adminSeoHead("Group Banners"),
  loader: ({ context }) => context.queryClient.query(groupBannersQueryOptions),
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
