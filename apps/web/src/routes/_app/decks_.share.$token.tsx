import { enumLabel, labelMap } from "@openrift/shared/enum-label";
import { deckShareDescription, deckShareTitle } from "@openrift/shared/share-titles";
import type { PublicDeckDetailResponse } from "@openrift/shared/types/api/deck";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { LinkGoneState } from "@/components/link-gone-state";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { publicDeckQueryOptions } from "@/features/decks/lib/decks-queries";
import { initQueryOptions } from "@/lib/init-queries";
import { seoHead } from "@/lib/seo";
import { isNotFoundSentinel } from "@/lib/server-fns/api-error";
import { deckShareImageUrl, shareImageVersion } from "@/lib/share-image";
import { getSiteUrl } from "@/lib/site-config";
import { cn, PAGE_WIDTH, PAGE_PADDING } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface SharedDeckHeadData {
  deck: Pick<PublicDeckDetailResponse["deck"], "name" | "description" | "updatedAt">;
  formatLabel: string;
  owner: Pick<PublicDeckDetailResponse["owner"], "displayName">;
}

export const Route = createFileRoute("/_app/decks_/share/$token")({
  head: ({ loaderData, params }) => {
    const siteUrl = getSiteUrl();
    const path = `/decks/share/${params.token}`;
    const data = loaderData as SharedDeckHeadData | undefined;
    if (!data) {
      return seoHead({ siteUrl, title: "Shared deck", path, unlisted: true });
    }
    const { deck, formatLabel, owner } = data;
    // Versioned off the deck's updatedAt so the immutable image URL busts on edit.
    const ogImage = deckShareImageUrl(siteUrl, params.token, shareImageVersion(deck.updatedAt));
    const title = deckShareTitle(deck.name, formatLabel);
    const description = deck.description ?? deckShareDescription(formatLabel, owner.displayName);
    return seoHead({
      siteUrl,
      title,
      description,
      path,
      ogImage,
      oembed: true,
      unlisted: true,
    });
  },
  // Returns only what head reads: loader data is dehydrated beside the query
  // cache, and returning the whole response would ship it twice.
  loader: async ({ context, params }): Promise<SharedDeckHeadData> => {
    try {
      const [data, init] = await Promise.all([
        context.queryClient.query({ ...publicDeckQueryOptions(params.token), staleTime: "static" }),
        context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
      ]);
      const { name, format, description, updatedAt } = data.deck;
      return {
        deck: { name, description, updatedAt },
        formatLabel: enumLabel(labelMap(init.enums.deckFormats ?? []), format),
        owner: { displayName: data.owner.displayName },
      };
    } catch (error) {
      if (isNotFoundSentinel(error)) {
        throw notFound();
      }
      throw error;
    }
  },
  pendingComponent: SharedDeckPending,
  errorComponent: RouteErrorFallback,
  notFoundComponent: () => (
    <LinkGoneState
      title={m.common_share_gone_title()}
      description={m.decks_share_gone_description()}
      action={
        <Link to="/decks" className={buttonVariants()}>
          {m.decks_share_gone_action()}
        </Link>
      }
    />
  ),
});

/** Mirrors the loaded page's shape (KPI strip, zone tiles, deck block) so content pops in without a layout jump. */
function SharedDeckPending() {
  return (
    <div className={cn(PAGE_PADDING, PAGE_WIDTH.full, "flex flex-col gap-6 py-4 pt-6")}>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
