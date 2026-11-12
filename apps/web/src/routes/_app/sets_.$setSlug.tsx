import { legendDisplayName } from "@openrift/shared/card-name";
import { cardPath } from "@openrift/shared/site-paths";
import type { SetDetailResponse } from "@openrift/shared/types/api/catalog";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { publicSetDetailQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { breadcrumbJsonLd, collectionPageJsonLd, seoHead } from "@/lib/seo";
import { isNotFoundSentinel } from "@/lib/server-fns/api-error";
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
      return seoHead({ siteUrl, title: "Set" });
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
    let data: SetDetailResponse;
    try {
      data = await context.queryClient.query({
        ...publicSetDetailQueryOptions(params.setSlug),
        staleTime: "static",
      });
    } catch (error) {
      if (isNotFoundSentinel(error)) {
        throw notFound();
      }
      throw error;
    }
    const seenCardIds = new Set<string>();
    const items: JsonLdItem[] = [];
    for (const printing of data.printings) {
      if (seenCardIds.has(printing.cardId)) {
        continue;
      }
      seenCardIds.add(printing.cardId);
      const card = data.cards[printing.cardId];
      if (!card) {
        continue;
      }
      items.push({ name: legendDisplayName(card), url: cardPath(card.slug) });
    }
    return {
      slug: data.set.slug,
      name: data.set.name,
      cardCount: seenCardIds.size,
      printingCount: new Set(data.printings.map((p) => p.printingId)).size,
      items,
    };
  },
  component: () => null,
  pendingComponent: () => null,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});
