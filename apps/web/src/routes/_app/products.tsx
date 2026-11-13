import { imageUrl } from "@openrift/shared/image-url";
import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { productsListQueryOptions } from "@/features/cards/lib/products-queries";
import { collectionPageJsonLd, seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

const PRODUCTS_TITLE = "Riftbound Products";

export const PRODUCTS_DESCRIPTION =
  "Full card lists for every official Riftbound product. See exactly which cards are inside each starter set, champion deck, and pre-rift kit.";

interface ProductsHeadData {
  items: { url: string; name: string; image?: string }[];
}

export const Route = createFileRoute("/_app/products")({
  head: ({ loaderData }) => {
    const siteUrl = getSiteUrl();
    const head = seoHead({
      siteUrl,
      title: PRODUCTS_TITLE,
      description: PRODUCTS_DESCRIPTION,
      path: "/products",
    });
    const data = loaderData as ProductsHeadData | undefined;
    if (!data) {
      return head;
    }
    return {
      ...head,
      scripts: [
        collectionPageJsonLd({
          siteUrl,
          name: PRODUCTS_TITLE,
          description: PRODUCTS_DESCRIPTION,
          path: "/products",
          items: data.items,
        }),
      ],
    };
  },
  loader: async ({ context }): Promise<ProductsHeadData> => {
    const data = await context.queryClient.query({
      ...productsListQueryOptions,
      staleTime: "static",
    });
    return {
      items: data.products.map((product) => ({
        url: `/products/${product.slug}`,
        name: product.name,
        image: product.coverCards[0] ? imageUrl(product.coverCards[0].imageId, "full") : undefined,
      })),
    };
  },
  errorComponent: RouteErrorFallback,
});
