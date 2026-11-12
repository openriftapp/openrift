import { legendDisplayName } from "@openrift/shared/card-name";
import type { ProductDetailResponse } from "@openrift/shared/contracts/products";
import { cardPath } from "@openrift/shared/site-paths";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { productDetailQueryOptions } from "@/features/cards/lib/products-queries";
import { cleanedSearchForRedirect, filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { breadcrumbJsonLd, collectionPageJsonLd, seoHead } from "@/lib/seo";
import { isNotFoundSentinel } from "@/lib/server-fns/api-error";
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
    let data: ProductDetailResponse;
    try {
      data = await context.queryClient.query({
        ...productDetailQueryOptions(params.slug),
        select: undefined,
        staleTime: "static",
      });
    } catch (error) {
      if (isNotFoundSentinel(error)) {
        throw notFound();
      }
      throw error;
    }
    const seenCardIds = new Set<string>();
    const items: { name: string; url: string }[] = [];
    for (const printing of data.printings) {
      if (seenCardIds.has(printing.cardId)) {
        continue;
      }
      seenCardIds.add(printing.cardId);
      const card = data.cards[printing.cardId];
      if (card) {
        items.push({ name: legendDisplayName(card), url: cardPath(card.slug) });
      }
    }
    const { name, description, cardTotal } = data.product;
    return { product: { name, description, cardTotal }, items };
  },
  pendingComponent: ProductDetailPending,
  errorComponent: RouteErrorFallback,
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
