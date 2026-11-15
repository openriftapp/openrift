import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminDashboardQueryOptions } from "@/features/admin/lib/admin-dashboard-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/")({
  head: () => adminSeoHead("Dashboard"),
  loader: async ({ context }) => {
    await context.queryClient.query({ ...adminDashboardQueryOptions, staleTime: "static" });
  },
  pendingComponent: AdminPending,
});
