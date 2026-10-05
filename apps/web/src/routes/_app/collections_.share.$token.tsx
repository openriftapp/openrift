import type { PublicCollectionDetailResponse } from "@openrift/shared/types/api/collection";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { LinkGoneState } from "@/components/link-gone-state";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cleanedSearchForRedirect, filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { publicCollectionQueryOptions } from "@/features/collections/lib/collections-queries";
import { seoHead } from "@/lib/seo";
import { isNotFoundSentinel } from "@/lib/server-fns/api-error";
import { collectionShareImageUrl, shareImageVersion } from "@/lib/share-image";
import { getSiteUrl } from "@/lib/site-config";
import { cn, PAGE_WIDTH, PAGE_PADDING } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/_app/collections_/share/$token")({
  validateSearch: filterSearchSchema,
  beforeLoad: ({ search, location, params }) => {
    const cleaned = cleanedSearchForRedirect(filterSearchSchema, search, location.searchStr);
    if (cleaned) {
      throw redirect({ to: "/collections/share/$token", params, search: cleaned, replace: true });
    }
  },
  head: ({ loaderData, params }) => {
    const siteUrl = getSiteUrl();
    const path = `/collections/share/${params.token}`;
    const data = loaderData as PublicCollectionDetailResponse | undefined;
    if (!data) {
      return seoHead({ siteUrl, title: "Shared collection", path, unlisted: true });
    }
    const { collection, owner } = data;
    const title = `${collection.name} (collection)`;
    const description =
      collection.description ?? `A Riftbound card collection shared by ${owner.displayName}.`;
    // Copies changing does not bump collections.updatedAt, so fold copyCount
    // into the version to bust the immutably-cached og:image on add/remove.
    const version = `${shareImageVersion(collection.updatedAt)}-${collection.copyCount}`;
    const ogImage = collectionShareImageUrl(siteUrl, params.token, version);
    return seoHead({ siteUrl, title, description, path, ogImage, oembed: true, unlisted: true });
  },
  loader: async ({ context, params }): Promise<PublicCollectionDetailResponse> => {
    try {
      return await context.queryClient.query({
        ...publicCollectionQueryOptions(params.token),
        staleTime: "static",
      });
    } catch (error) {
      if (isNotFoundSentinel(error)) {
        throw notFound();
      }
      throw error;
    }
  },
  pendingComponent: SharedCollectionPending,
  errorComponent: RouteErrorFallback,
  notFoundComponent: () => (
    <LinkGoneState
      title={m.common_share_gone_title()}
      description={m.collections_share_gone_description()}
      action={
        <Link to="/cards" className={buttonVariants()}>
          {m.common_browse_cards()}
        </Link>
      }
    />
  ),
});

function SharedCollectionPending() {
  return (
    <div className={cn(PAGE_PADDING, PAGE_WIDTH.full, "flex flex-col gap-4 py-4")}>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
