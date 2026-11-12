import { enumLabel, labelMap } from "@openrift/shared/enum-label";
import type { MetaDeckDetailResponse } from "@openrift/shared/types/api/meta";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { archivedDeckIdentity } from "@/features/meta/lib/meta-deck-identity";
import { formatRank } from "@/features/meta/lib/meta-format";
import { metaDeckQueryOptions } from "@/features/meta/lib/meta-queries";
import { initQueryOptions } from "@/lib/init-queries";
import { breadcrumbJsonLd, seoHead } from "@/lib/seo";
import { isNotFoundSentinel } from "@/lib/server-fns/api-error";
import { deckShareImageUrl, shareImageVersion } from "@/lib/share-image";
import { getSiteUrl } from "@/lib/site-config";
import { PAGE_WIDTH, PAGE_PADDING, cn } from "@/lib/utils";

interface MetaDeckHeadData {
  deck: Pick<MetaDeckDetailResponse["deck"], "updatedAt">;
  formatLabel: string;
  meta: Pick<MetaDeckDetailResponse["meta"], "playerName" | "rank" | "rankIsTier"> & {
    event: Pick<MetaDeckDetailResponse["meta"]["event"], "slug" | "name" | "eventDate">;
  };
  legend: string | null;
}

export const Route = createFileRoute("/_app/meta_/decks_/$token")({
  head: ({ loaderData, params }) => {
    const siteUrl = getSiteUrl();
    const path = `/meta/decks/${params.token}`;
    const data = loaderData as MetaDeckHeadData | undefined;
    if (!data) {
      return seoHead({ siteUrl, title: "Archived deck", path, unlisted: true });
    }
    const finish = formatRank(data.meta.rank, data.meta.rankIsTier);
    const { legend } = data;
    const named = legend ?? data.meta.playerName;
    const title = `${named}, ${finish} at ${data.meta.event.name}`;
    const piloted = legend === null ? `this ${data.formatLabel} deck` : legend;
    const description = `${data.meta.playerName} piloted ${piloted} to ${finish} at ${data.meta.event.name} (${data.meta.event.eventDate}).`;
    const ogImage = deckShareImageUrl(
      siteUrl,
      params.token,
      shareImageVersion(data.deck.updatedAt),
    );
    return {
      ...seoHead({ siteUrl, title, description, path, ogImage }),
      scripts: [
        breadcrumbJsonLd(siteUrl, [
          { name: "Meta Archive", path: "/meta" },
          { name: data.meta.event.name, path: `/meta/${data.meta.event.slug}` },
          { name: named, path },
        ]),
      ],
    };
  },
  // Returns only what head reads: loader data is dehydrated beside the query
  // cache, and returning the whole response would ship it twice.
  loader: async ({ context, params }): Promise<MetaDeckHeadData> => {
    try {
      const [init, deck] = await Promise.all([
        context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
        context.queryClient.query({ ...metaDeckQueryOptions(params.token), staleTime: "static" }),
      ]);
      const { playerName, rank, rankIsTier, event } = deck.meta;
      return {
        deck: { updatedAt: deck.deck.updatedAt },
        formatLabel: enumLabel(labelMap(init.enums.deckFormats ?? []), deck.deck.format),
        meta: {
          playerName,
          rank,
          rankIsTier,
          event: { slug: event.slug, name: event.name, eventDate: event.eventDate },
        },
        legend: archivedDeckIdentity(deck.cards)?.name ?? null,
      };
    } catch (error) {
      if (isNotFoundSentinel(error)) {
        throw notFound();
      }
      throw error;
    }
  },
  pendingComponent: MetaDeckPending,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});

function MetaDeckPending() {
  return (
    <div className={cn(PAGE_PADDING, PAGE_WIDTH.full, "flex flex-col gap-4 py-4")}>
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
