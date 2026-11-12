import { imageUrl } from "@openrift/shared/image-url";
import { pluralize } from "@openrift/shared/strings";
import type { MetaLegendDetailResponse } from "@openrift/shared/types/api/meta";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { publicSetListQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { DECK_GRID_LIMIT } from "@/features/meta/lib/meta-deck-grid";
import { metaLegendSearchSchema } from "@/features/meta/lib/meta-legends-search";
import { metaDecksQueryOptions, metaLegendQueryOptions } from "@/features/meta/lib/meta-queries";
import { deriveSetEras, metaScopeQueryFromScope } from "@/features/meta/lib/meta-scope";
import { initQueryOptions } from "@/lib/init-queries";
import { breadcrumbJsonLd, seoHead, toAbsoluteUrl } from "@/lib/seo";
import { isNotFoundSentinel } from "@/lib/server-fns/api-error";
import { getSiteUrl } from "@/lib/site-config";
import { PAGE_WIDTH, PAGE_PADDING, cn } from "@/lib/utils";

/**
 * Route key is `<champion>-<card-slug>` (built by `metaLegendSlug` in
 * `@openrift/shared`), with the card slug always appended even when the
 * champion has only one legend, so the URL stays valid if a second legend
 * for that champion is printed later. A legend with no champion tag keys on
 * its card slug alone.
 */
interface MetaLegendHeadData {
  legend: Pick<MetaLegendDetailResponse["legend"], "name" | "imageId">;
  counts: Pick<MetaLegendDetailResponse["counts"], "finishes">;
}

export const Route = createFileRoute("/_app/meta_/legends_/$slug")({
  validateSearch: metaLegendSearchSchema,
  head: ({ loaderData, params }) => {
    const siteUrl = getSiteUrl();
    const path = `/meta/legends/${params.slug}`;
    const data = loaderData as MetaLegendHeadData | undefined;
    if (!data) {
      return seoHead({ siteUrl, title: "Legend", path, unlisted: true });
    }
    const { legend, counts } = data;
    const description = `${legend.name} in the Riftbound meta archive: ${counts.finishes} archived ${pluralize(counts.finishes, "finish", "finishes")}, the players behind them, and the decklists they registered.`;
    const ogImage = toAbsoluteUrl(
      siteUrl,
      legend.imageId === null ? undefined : imageUrl(legend.imageId, "full"),
    );
    return {
      ...seoHead({
        siteUrl,
        title: `${legend.name} in the Meta Archive`,
        description,
        path,
        ogImage,
      }),
      scripts: [
        breadcrumbJsonLd(siteUrl, [
          { name: "Meta Archive", path: "/meta" },
          { name: "Legends", path: "/meta/legends" },
          { name: legend.name, path },
        ]),
      ],
    };
  },
  loaderDeps: ({ search }) => search,
  // Returns only what head reads: loader data is dehydrated beside the query
  // cache, and returning the whole response would ship it twice.
  loader: async ({ context, params, deps }): Promise<MetaLegendHeadData> => {
    try {
      const [sets] = await Promise.all([
        context.queryClient.query({ ...publicSetListQueryOptions, staleTime: "static" }),
        context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
      ]);
      const query = metaScopeQueryFromScope(deps, deriveSetEras(sets.sets));
      const legend = await context.queryClient.query({
        ...metaLegendQueryOptions(params.slug, query),
        staleTime: "static",
      });
      await context.queryClient.query({
        ...metaDecksQueryOptions({
          ...query,
          legend: legend.legend.cardId,
          limit: DECK_GRID_LIMIT,
        }),
        staleTime: "static",
      });
      return {
        legend: { name: legend.legend.name, imageId: legend.legend.imageId },
        counts: { finishes: legend.counts.finishes },
      };
    } catch (error) {
      if (isNotFoundSentinel(error)) {
        throw notFound();
      }
      throw error;
    }
  },
  pendingComponent: MetaLegendPending,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});

function MetaLegendPending() {
  return (
    <div className={cn(PAGE_PADDING, PAGE_WIDTH.capped, "flex flex-col gap-4 py-4")}>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
