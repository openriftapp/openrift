import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import {
  adminFeatureFlagOverridesQueryOptions,
  adminFeatureFlagsQueryOptions,
} from "@/features/admin/lib/admin-feature-flags-queries";
import { adminUsersQueryOptions } from "@/features/admin/lib/admin-users-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/feature-flags")({
  head: () => adminSeoHead("Feature Flags"),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query({ ...adminFeatureFlagsQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...adminFeatureFlagOverridesQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...adminUsersQueryOptions, staleTime: "static" }),
    ]),
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
