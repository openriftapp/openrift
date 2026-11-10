import type { PublicTierListDetailResponse } from "@openrift/shared/types/api/tier-list";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { LinkGoneState } from "@/components/link-gone-state";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { publicTierListQueryOptions } from "@/features/stage/lib/tier-lists-queries";
import { seoHead } from "@/lib/seo";
import { isNotFoundSentinel } from "@/lib/server-fns/api-error";
import { shareImageVersion, tierListShareImageUrl } from "@/lib/share-image";
import { getSiteUrl } from "@/lib/site-config";
import { cn, PAGE_WIDTH, PAGE_PADDING } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface SharedTierListHeadData {
  tierList: Pick<PublicTierListDetailResponse["tierList"], "title" | "description" | "updatedAt">;
  owner: Pick<PublicTierListDetailResponse["owner"], "displayName">;
  rankedCount: number;
}

export const Route = createFileRoute("/_app/tier-lists_/share/$token")({
  head: ({ loaderData, params }) => {
    const siteUrl = getSiteUrl();
    const path = `/tier-lists/share/${params.token}`;
    const data = loaderData as SharedTierListHeadData | undefined;
    if (!data) {
      return seoHead({ siteUrl, title: "Shared tier list", path, unlisted: true });
    }
    const { tierList, owner, rankedCount } = data;
    // Server-rendered board image, versioned off updatedAt (which every save
    // advances), so the immutably-cached URL busts whenever the ranking changes.
    const ogImage = tierListShareImageUrl(
      siteUrl,
      params.token,
      shareImageVersion(tierList.updatedAt),
    );
    return seoHead({
      siteUrl,
      title: tierList.title,
      description:
        tierList.description ??
        `A Riftbound tier list by ${owner.displayName}, ranking ${rankedCount} cards.`,
      path,
      ogImage,
      oembed: true,
      unlisted: true,
    });
  },
  // Returns only what head reads: loader data is dehydrated beside the query
  // cache, and returning the whole response would ship it twice.
  loader: async ({ context, params }): Promise<SharedTierListHeadData> => {
    try {
      const data = await context.queryClient.query({
        ...publicTierListQueryOptions(params.token),
        staleTime: "static",
      });
      const { title, description, updatedAt, tiers } = data.tierList;
      return {
        tierList: { title, description, updatedAt },
        owner: { displayName: data.owner.displayName },
        rankedCount: tiers.reduce((sum, tier) => sum + tier.cards.length, 0),
      };
    } catch (error) {
      if (isNotFoundSentinel(error)) {
        throw notFound();
      }
      throw error;
    }
  },
  pendingComponent: SharedTierListPending,
  errorComponent: RouteErrorFallback,
  notFoundComponent: () => (
    <LinkGoneState
      title={m.common_share_gone_title()}
      description={m.tier_lists_share_gone_description()}
      action={
        <Link to="/cards" className={buttonVariants()}>
          {m.common_browse_cards()}
        </Link>
      }
    />
  ),
});

function SharedTierListPending() {
  return (
    <div className={cn(PAGE_PADDING, PAGE_WIDTH.full, "flex flex-col gap-4 py-4 pt-6")}>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
