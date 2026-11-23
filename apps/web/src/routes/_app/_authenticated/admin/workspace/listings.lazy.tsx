import { createLazyFileRoute } from "@tanstack/react-router";

import { ListingsPage } from "@/features/catalog-workspace/components/listings-page";

export const Route = createLazyFileRoute("/_app/_authenticated/admin/workspace/listings")({
  component: ListingsPage,
});
