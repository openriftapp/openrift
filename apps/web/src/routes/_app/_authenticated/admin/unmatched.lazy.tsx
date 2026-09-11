import { createLazyFileRoute } from "@tanstack/react-router";

import { UnmatchedProductsPage } from "@/features/admin/components/unmatched-products-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/unmatched")({
  component: UnmatchedProductsPage,
});
