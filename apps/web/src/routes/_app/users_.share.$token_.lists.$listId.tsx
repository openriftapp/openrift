import type { PublicListDetailResponse } from "@openrift/shared/types/api/list";
import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { LinkGoneState } from "@/components/link-gone-state";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cleanedSearchForRedirect, filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { publicUserBundleListQueryOptions } from "@/features/groups/lib/user-share-queries";
import { seoHead } from "@/lib/seo";
import { isNotFoundSentinel } from "@/lib/server-fns/api-error";
import { bundleShareImageUrl, shareImageVersion } from "@/lib/share-image";
import { getSiteUrl } from "@/lib/site-config";
import { cn, PAGE_WIDTH, PAGE_PADDING } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/_app/users_/share/$token_/lists/$listId")({
  validateSearch: filterSearchSchema,
  beforeLoad: ({ search, location, params }) => {
    const cleaned = cleanedSearchForRedirect(filterSearchSchema, search, location.searchStr);
    if (cleaned) {
      throw redirect({
        to: "/users/share/$token/lists/$listId",
        params,
        search: cleaned,
        replace: true,
      });
    }
  },
  head: ({ loaderData, params }) => {
    const siteUrl = getSiteUrl();
    const path = `/users/share/${params.token}/lists/${params.listId}`;
    const data = loaderData as PublicListDetailResponse | undefined;
    if (!data) {
      return seoHead({ siteUrl, title: "Shared list", path, unlisted: true });
    }
    const { list, owner } = data;
    const title = `${list.name} (${list.intent} list)`;
    const description = `A Riftbound ${list.intent} list shared by ${owner.displayName}.`;
    // This page is reached via the bundle token, so its preview is the owner's
    // bundle image; bust it on this list's updates.
    const ogImage = bundleShareImageUrl(siteUrl, params.token, shareImageVersion(list.updatedAt));
    return seoHead({ siteUrl, title, description, path, ogImage, unlisted: true });
  },
  loader: async ({ context, params }): Promise<PublicListDetailResponse> => {
    try {
      return await context.queryClient.query({
        ...publicUserBundleListQueryOptions(params.token, params.listId),
        staleTime: "static",
      });
    } catch (error) {
      if (isNotFoundSentinel(error)) {
        throw notFound();
      }
      throw error;
    }
  },
  pendingComponent: BundleListPending,
  errorComponent: RouteErrorFallback,
  notFoundComponent: () => (
    <LinkGoneState
      title={m.common_share_gone_title()}
      description={m.lists_share_gone_description()}
      action={
        <Link to="/cards" className={buttonVariants()}>
          {m.common_browse_cards()}
        </Link>
      }
    />
  ),
});

function BundleListPending() {
  return (
    <div className={cn(PAGE_PADDING, PAGE_WIDTH.full, "flex flex-col gap-4 py-4")}>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
