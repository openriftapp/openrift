import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { adminProductPrintingIdsQueryOptions } from "@/features/admin/lib/booster-pools-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/booster-pools")({
  head: () => adminSeoHead("Booster Pools"),
  loader: ({ context }) =>
    context.queryClient.query({ ...adminProductPrintingIdsQueryOptions, staleTime: "static" }),
  pendingComponent: AdminPending,
});
