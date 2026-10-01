import { imageUrl } from "@openrift/shared/image-url";
import { compareCardDisplayName, legendDisplayName } from "@openrift/shared/utils";
import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { errataListQueryOptions } from "@/features/cards/lib/errata-queries";
import { errataContentVersion } from "@/features/cards/lib/errata-share-image";
import { initQueryOptions } from "@/lib/init-queries";
import { breadcrumbJsonLd, collectionPageJsonLd, seoHead } from "@/lib/seo";
import { errataShareImageUrl } from "@/lib/share-image";
import { getSiteUrl } from "@/lib/site-config";

const TITLE = "Riftbound Errata: Card Wording Changes";

interface ErrataHeadItem {
  name: string;
  url: string;
  image?: string;
}

interface ErrataHeadData {
  items: ErrataHeadItem[];
  imageVersion: number;
}

function errataDescription(cardCount: number): string {
  return `${cardCount} Riftbound cards Riot has reworded after printing, with the printed and the updated text side by side and every change marked.`;
}

export const Route = createFileRoute("/_app/errata")({
  head: ({ loaderData }) => {
    const siteUrl = getSiteUrl();
    const head = loaderData as ErrataHeadData | undefined;
    const items = head?.items ?? [];
    const description = errataDescription(items.length);
    return {
      ...seoHead({
        siteUrl,
        title: TITLE,
        description,
        path: "/errata",
        ogImage: head ? errataShareImageUrl(siteUrl, head.imageVersion) : undefined,
      }),
      scripts: [
        collectionPageJsonLd({ siteUrl, name: TITLE, description, path: "/errata", items }),
        breadcrumbJsonLd(siteUrl, [
          { name: "Cards", path: "/cards" },
          { name: "Errata", path: "/errata" },
        ]),
      ],
    };
  },
  loader: async ({ context }): Promise<ErrataHeadData> => {
    const [data] = await Promise.all([
      context.queryClient.query({ ...errataListQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
    ]);
    return {
      items: data.entries
        .toSorted((left, right) => compareCardDisplayName(left.card, right.card))
        .map((entry) => ({
          name: legendDisplayName(entry.card),
          url: `/cards/${entry.card.slug}`,
          image: entry.printing?.imageId ? imageUrl(entry.printing.imageId, "full") : undefined,
        })),
      imageVersion: errataContentVersion(data),
    };
  },
  component: () => null,
  pendingComponent: () => null,
  errorComponent: RouteErrorFallback,
});
