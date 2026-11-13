import type { SetDetailResponse } from "@openrift/shared/types/api/catalog";
import { createFileRoute } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { publicSetDetailQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { breadcrumbJsonLd, cardJsonLdItems, collectionPageJsonLd, seoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";
import { getSiteUrl } from "@/lib/site-config";

interface JsonLdItem {
  name: string;
  url: string;
}

interface SetHeadData {
  slug: string;
  name: string;
  cardCount: number;
  printingCount: number;
  items: JsonLdItem[];
}

export const Route = createFileRoute("/_app/sets_/$setSlug")({
  head: ({ loaderData }) => {
    const siteUrl = getSiteUrl();
    const data = loaderData as SetHeadData | undefined;
    if (!data) {
      return seoHead({ siteUrl, title: "Set", noIndex: true });
    }

    const setPath = `/sets/${data.slug}`;
    const description = `${data.name} contains ${data.cardCount} unique cards and ${data.printingCount} printings. Browse the complete set on OpenRift.`;
    const head = seoHead({
      siteUrl,
      title: `${data.name} - Riftbound Card Set`,
      description,
      path: setPath,
    });

    return {
      ...head,
      scripts: [
        collectionPageJsonLd({
          siteUrl,
          name: `${data.name} - Riftbound Card Set`,
          description,
          path: setPath,
          items: data.items,
        }),
        breadcrumbJsonLd(siteUrl, [
          { name: "Sets", path: "/sets" },
          { name: data.name, path: setPath },
        ]),
      ],
    };
  },
  // Returns only what head reads: loader data is dehydrated beside the query
  // cache, and returning the whole response would ship every printing twice.
  loader: async ({ context, params }): Promise<SetHeadData> => {
    const data: SetDetailResponse = await notFoundOnSentinel(
      context.queryClient.query({
        ...publicSetDetailQueryOptions(params.setSlug),
        staleTime: "static",
      }),
    );
    return {
      slug: data.set.slug,
      name: data.set.name,
      cardCount: new Set(data.printings.map((p) => p.cardId)).size,
      printingCount: new Set(data.printings.map((p) => p.printingId)).size,
      items: cardJsonLdItems(data.printings, data.cards),
    };
  },
  component: () => null,
  pendingComponent: () => null,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});
