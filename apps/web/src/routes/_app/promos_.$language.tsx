import { enumLabel, labelMap } from "@openrift/shared/enum-label";
import { RENAMED_LANGUAGES } from "@openrift/shared/well-known";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { publicPromoListQueryOptions } from "@/features/cards/lib/public-promos-queries";
import { cleanedSearchForRedirect, filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { initQueryOptions } from "@/lib/init-queries";
import { cardJsonLdItems, collectionPageJsonLd, seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

function promosDescription(languageName: string): string {
  return `Browse all ${languageName} promotional card printings for the Riftbound trading card game, grouped by promo type.`;
}

export const Route = createFileRoute("/_app/promos_/$language")({
  validateSearch: filterSearchSchema,
  beforeLoad: ({ search, location, params }) => {
    const upper = params.language.toUpperCase();
    const canonical = RENAMED_LANGUAGES[upper] ?? upper;
    if (canonical !== params.language) {
      throw redirect({
        to: "/promos/$language",
        params: { language: canonical },
        search,
        replace: true,
        statusCode: 301,
      });
    }

    // Strip unknown / malformed search params so bots following share links
    // land on a clean canonical URL.
    const cleaned = cleanedSearchForRedirect(filterSearchSchema, search, location.searchStr);
    if (cleaned) {
      throw redirect({
        to: "/promos/$language",
        params: { language: params.language },
        search: cleaned,
        replace: true,
      });
    }
  },
  loader: async ({ params, context }) => {
    // Only the JSON-LD items and language name are returned: the loaderData return value is
    // serialized on top of the dehydrated queries, doubling the payload.
    const [data, init] = await Promise.all([
      context.queryClient.query({
        ...publicPromoListQueryOptions(params.language),
        staleTime: "static",
      }),
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
    ]);
    if (data.printings.length === 0) {
      throw notFound();
    }

    const languageName = enumLabel(labelMap(init.enums.languages ?? []), params.language);
    return { items: cardJsonLdItems(data.printings, data.cards), languageName };
  },
  head: ({ params, loaderData }) => {
    const siteUrl = getSiteUrl();
    const path = `/promos/${params.language}`;
    const items = loaderData?.items ?? [];
    const languageName = loaderData?.languageName ?? params.language;
    const description = promosDescription(languageName);
    const head = seoHead({
      siteUrl,
      title: `Riftbound Promo Cards in ${languageName}`,
      description,
      path,
    });

    return {
      ...head,
      scripts: [
        collectionPageJsonLd({
          siteUrl,
          name: `Riftbound Promo Cards in ${languageName}`,
          description,
          path,
          items,
        }),
      ],
    };
  },
});
