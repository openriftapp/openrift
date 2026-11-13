import { imageUrl } from "@openrift/shared/image-url";
import { createFileRoute } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { publicSetListQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { collectionPageJsonLd, seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

const SETS_DESCRIPTION =
  "Browse all Riftbound card sets. View cards, printings, and details for each set.";

interface SetsHeadData {
  items: { name: string; url: string; image?: string }[];
}

export const Route = createFileRoute("/_app/sets")({
  head: ({ loaderData }) => {
    const siteUrl = getSiteUrl();
    const data = loaderData as SetsHeadData | undefined;
    const head = seoHead({
      siteUrl,
      title: "Riftbound Card Sets",
      description: SETS_DESCRIPTION,
      path: "/sets",
    });
    return {
      ...head,
      scripts: [
        collectionPageJsonLd({
          siteUrl,
          name: "Riftbound Card Sets",
          description: SETS_DESCRIPTION,
          path: "/sets",
          items: data?.items ?? [],
        }),
      ],
    };
  },
  loader: async ({ context }): Promise<SetsHeadData> => {
    const data = await context.queryClient.query({
      ...publicSetListQueryOptions,
      staleTime: "static",
    });
    return {
      items: data.sets.map((set) => ({
        name: set.name,
        url: `/sets/${set.slug}`,
        image: set.coverImageId ? imageUrl(set.coverImageId, "full") : undefined,
      })),
    };
  },
  component: () => null,
  pendingComponent: () => null,
  errorComponent: RouteErrorFallback,
});
