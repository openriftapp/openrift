import { createFileRoute } from "@tanstack/react-router";

import { AdminPending } from "@/features/admin/components/admin-route-components";
import { ignoredProductsQueryOptions } from "@/features/admin/lib/ignored-products-queries";
import { adminSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/_authenticated/admin/ignored-products")({
  head: () => adminSeoHead("Ignored Products"),
  loader: ({ context }) =>
    context.queryClient.query({ ...ignoredProductsQueryOptions, staleTime: "static" }),
  pendingComponent: AdminPending,
});
