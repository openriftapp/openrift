import { createLazyFileRoute } from "@tanstack/react-router";

import { ProductsIndexPage } from "@/features/cards/components/products-index-page";

export const Route = createLazyFileRoute("/_app/products")({
  component: ProductsIndexPage,
});
