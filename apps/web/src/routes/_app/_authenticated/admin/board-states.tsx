import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminBoardStatesQueryOptions } from "@/features/admin/lib/board-states-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/board-states")({
  head: () => adminSeoHead("Board States"),
  loader: ({ context }) => context.queryClient.query(adminBoardStatesQueryOptions),
  pendingComponent: AdminPending,
  errorComponent: RouteErrorFallback,
});
