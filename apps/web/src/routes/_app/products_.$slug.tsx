import type { ProductDetailResponse } from "@openrift/shared/contracts/products";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { productDetailQueryOptions } from "@/features/cards/lib/products-queries";
import { cleanedSearchForRedirect, filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { breadcrumbJsonLd, cardJsonLdItems, collectionPageJsonLd, seoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";
import { getSiteUrl } from "@/lib/site-config";
import { cn, PAGE_WIDTH, PAGE_PADDING } from "@/lib/utils";

interface ProductHeadData {
  product: Pick<ProductDetailResponse["product"], "name" | "description" | "cardTotal">;
  items: { name: string; url: string }[];
}

export const Route = createFileRoute("/_app/products_/$slug")({
  validateSearch: filterSearchSchema,
  beforeLoad: ({ search, location, params }) => {
    const cleaned = cleanedSearchForRedirect(filterSearchSchema, search, location.searchStr);
    if (cleaned) {
      throw redirect({ to: "/products/$slug", params, search: cleaned, replace: true });
    }
  },
  head: ({ loaderData, params }) => {
    const siteUrl = getSiteUrl();
    const path = `/products/${params.slug}`;
    const data = loaderData as ProductHeadData | undefined;
    if (!data) {
      return seoHead({ siteUrl, title: "Product", path, unlisted: true });
    }
    const { product, items } = data;
    const description =
      product.description ??
      `Every card in ${product.name}, a fixed-content Riftbound product (${product.cardTotal} cards).`;
    const head = seoHead({ siteUrl, title: product.name, description, path });

    return {
      ...head,
      scripts: [
        collectionPageJsonLd({ siteUrl, name: product.name, description, path, items }),
        breadcrumbJsonLd(siteUrl, [
          { name: "Products", path: "/products" },
          { name: product.name, path },
        ]),
      ],
    };
  },
  // Returns only what head reads: loader data is dehydrated beside the query
  // cache, and returning the whole response would ship every printing twice.
  loader: async ({ context, params }): Promise<ProductHeadData> => {
    const data: ProductDetailResponse = await notFoundOnSentinel(
      context.queryClient.query({
        ...productDetailQueryOptions(params.slug),
        select: undefined,
        staleTime: "static",
      }),
    );
    const { name, description, cardTotal } = data.product;
    return {
      product: { name, description, cardTotal },
      items: cardJsonLdItems(data.printings, data.cards),
    };
  },
  pendingComponent: ProductDetailPending,
  notFoundComponent: NotFoundFallback,
});

function ProductDetailPending() {
  return (
    <div className={cn(PAGE_PADDING, PAGE_WIDTH.full, "flex flex-col gap-4 pt-12 pb-4")}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-80" />
      <Skeleton className="mt-6 h-8 w-48" />
      <Skeleton className="mt-6 h-96 w-full" />
    </div>
  );
}
