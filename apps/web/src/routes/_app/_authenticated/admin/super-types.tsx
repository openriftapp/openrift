import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminSeoHead } from "@/lib/seo";
import { adminSuperTypesQueryOptions } from "@/lib/super-types-queries";

export const Route = createFileRoute("/_app/_authenticated/admin/super-types")({
  head: () => adminSeoHead("Supertypes"),
  loader: ({ context }) =>
    context.queryClient.query({ ...adminSuperTypesQueryOptions, staleTime: "static" }),
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
