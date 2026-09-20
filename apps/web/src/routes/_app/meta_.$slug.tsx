import type { MetaEventDetail } from "@openrift/shared/types/api/meta";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { metaEventHasArchivedResults, metaEventSeoTitle } from "@/features/meta/lib/meta-format";
import { metaEventQueryOptions, metaStandingsQueryOptions } from "@/features/meta/lib/meta-queries";
import {
  metaStandingsSearchSchema,
  standingsPageQuery,
} from "@/features/meta/lib/meta-standings-search";
import type { FeatureFlags } from "@/lib/feature-flags";
import { featureEnabled, featureFlagsQueryOptions } from "@/lib/feature-flags";
import { initQueryOptions } from "@/lib/init-queries";
import { breadcrumbJsonLd, seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";
import { PAGE_WIDTH, PAGE_PADDING, cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/meta_/$slug")({
  validateSearch: metaStandingsSearchSchema,
  loaderDeps: ({ search }) => ({
    q: search.q,
    list: search.list,
    legend: search.legend,
  }),
  head: ({ loaderData, params }) => {
    const siteUrl = getSiteUrl();
    const path = `/meta/${params.slug}`;
    const event = loaderData as MetaEventDetail | undefined;
    if (!event) {
      return seoHead({ siteUrl, title: "Event", path, unlisted: true });
    }
    const title = metaEventSeoTitle(event);
    if (!metaEventHasArchivedResults(event)) {
      return seoHead({ siteUrl, title, path, unlisted: true });
    }
    const description = `${event.name} on ${event.eventDate}: standings for ${event.playerRowCount} Riftbound ${event.format} ${event.playerRowCount === 1 ? "player" : "players"}, with ${event.deckCount} archived ${event.deckCount === 1 ? "decklist" : "decklists"}.`;
    return {
      ...seoHead({ siteUrl, title, description, path }),
      scripts: [
        breadcrumbJsonLd(siteUrl, [
          { name: "Meta Archive", path: "/meta" },
          { name: event.name, path },
        ]),
      ],
    };
  },
  // The flag check lives in the loader, not beforeLoad: a beforeLoad combined
  // with a head() that reads loaderData collapses the route-context type to
  // `never` in the current TanStack Router version. Same pattern as
  // help_.$slug.tsx; the redirect still fires before anything renders.
  // Returns the event alone: loader data is dehydrated beside the query cache,
  // and returning the whole response would ship the standings twice.
  loader: async ({ context, params, deps, location }): Promise<MetaEventDetail> => {
    const flags = (await context.queryClient.query({
      ...featureFlagsQueryOptions,
      staleTime: "static",
    })) as FeatureFlags;
    if (!featureEnabled(flags, "meta")) {
      throw redirect({ to: "/cards" });
    }
    try {
      const [, detail] = await Promise.all([
        context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
        context.queryClient.query({ ...metaEventQueryOptions(params.slug), staleTime: "static" }),
      ]);
      const total = detail.standings.total;
      const unnarrowed = metaStandingsQueryOptions(params.slug, standingsPageQuery({}, total));
      if (context.queryClient.getQueryData(unnarrowed.queryKey) === undefined) {
        context.queryClient.setQueryData(unnarrowed.queryKey, detail.standings);
      }
      // Page and size are read from the location, deliberately outside the deps.
      const landed = metaStandingsSearchSchema.parse(location.search);
      await context.queryClient.query({
        ...metaStandingsQueryOptions(
          params.slug,
          standingsPageQuery({ ...deps, page: landed.page, per: landed.per }, total),
        ),
        staleTime: "static",
      });
      return detail.event;
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        throw notFound();
      }
      throw error;
    }
  },
  pendingComponent: MetaEventPending,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});

function MetaEventPending() {
  return (
    <div className={cn(PAGE_PADDING, PAGE_WIDTH.full, "flex flex-col gap-4 py-4")}>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
