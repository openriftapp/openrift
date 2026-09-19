import { formatRank } from "@openrift/shared/meta-standings";
import type { MetaEventRunResponse } from "@openrift/shared/types/api/meta";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { metaRunQueryOptions } from "@/features/meta/lib/meta-queries";
import type { FeatureFlags } from "@/lib/feature-flags";
import { featureEnabled, featureFlagsQueryOptions } from "@/lib/feature-flags";
import { initQueryOptions } from "@/lib/init-queries";
import { breadcrumbJsonLd, seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";
import { PAGE_WIDTH, PAGE_PADDING, cn } from "@/lib/utils";

export type MetaEventRunLoaderData = Pick<MetaEventRunResponse, "event" | "player">;

export const Route = createFileRoute("/_app/meta_/$slug_/players_/$key")({
  head: ({ loaderData, params }) => {
    const siteUrl = getSiteUrl();
    const path = `/meta/${params.slug}/players/${encodeURIComponent(params.key)}`;
    const data = loaderData as MetaEventRunLoaderData | undefined;
    if (!data) {
      return seoHead({ siteUrl, title: "Tournament run", path, unlisted: true });
    }
    const { event, player } = data;
    const title = `${player.playerName} at ${event.name}`;
    const description = `${player.playerName} finished ${formatRank(player.rank, player.rankIsTier)} at ${event.name} on ${event.eventDate}: every round, opponent and result the organizer published.`;
    return {
      ...seoHead({ siteUrl, title, description, path }),
      scripts: [
        breadcrumbJsonLd(siteUrl, [
          { name: "Meta Archive", path: "/meta" },
          { name: event.name, path: `/meta/${params.slug}` },
          { name: player.playerName, path },
        ]),
      ],
    };
  },
  // The flag check lives in the loader, not beforeLoad: a beforeLoad combined
  // with a head() that reads loaderData collapses the route-context type to
  // `never` in the current TanStack Router version. Same pattern as
  // meta_.$slug.tsx; the redirect still fires before anything renders.
  loader: async ({ context, params }): Promise<MetaEventRunLoaderData> => {
    const flags = (await context.queryClient.query({
      ...featureFlagsQueryOptions,
      staleTime: "static",
    })) as FeatureFlags;
    if (!featureEnabled(flags, "meta")) {
      throw redirect({ to: "/cards" });
    }
    let run;
    try {
      [, run] = await Promise.all([
        context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
        context.queryClient.query({
          ...metaRunQueryOptions(params.slug, params.key),
          staleTime: "static",
        }),
      ]);
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        throw notFound();
      }
      throw error;
    }
    if (run.rounds.length === 0) {
      throw notFound();
    }
    return { event: run.event, player: run.player };
  },
  pendingComponent: MetaEventRunPending,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});

function MetaEventRunPending() {
  return (
    <div className={cn(PAGE_PADDING, PAGE_WIDTH.capped, "flex flex-col gap-4 py-4")}>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
