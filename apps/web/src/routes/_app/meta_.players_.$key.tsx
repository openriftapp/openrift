import { META_MAX_LIST_PAGE_SIZE } from "@openrift/shared/meta-query";
import { pluralize } from "@openrift/shared/strings";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { Skeleton } from "@/components/ui/skeleton";
import { publicSetListQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { metaDecksQueryOptions, metaPlayerQueryOptions } from "@/features/meta/lib/meta-queries";
import {
  ERA_ALL,
  deriveSetEras,
  metaScopeQueryFromScope,
  metaScopeSearchSchema,
  scopeWithDefaultEra,
} from "@/features/meta/lib/meta-scope";
import { initQueryOptions } from "@/lib/init-queries";
import { breadcrumbJsonLd, seoHead } from "@/lib/seo";
import { isNotFoundSentinel } from "@/lib/server-fns/api-error";
import { getSiteUrl } from "@/lib/site-config";
import { PAGE_WIDTH, PAGE_PADDING, cn } from "@/lib/utils";

/**
 * The route key is the identity a source filed the player's standings rows
 * under, folded by `metaPlayerKey` (`@openrift/shared`): `u347713` for a
 * uvsgames account, `pn<name>` for a playloltcg name. The archive keeps no
 * player table of its own, so the key is the source's and the page is whatever
 * the source published under it.
 */
interface MetaPlayerHeadData {
  name: string;
  finishCount: number;
}

export const Route = createFileRoute("/_app/meta_/players_/$key")({
  validateSearch: metaScopeSearchSchema,
  head: ({ loaderData, params }) => {
    const siteUrl = getSiteUrl();
    const path = `/meta/players/${encodeURIComponent(params.key)}`;
    const data = loaderData as MetaPlayerHeadData | undefined;
    if (!data) {
      return seoHead({ siteUrl, title: "Player", path, unlisted: true });
    }
    const { name, finishCount } = data;
    const description = `${name} in the Riftbound meta archive: ${finishCount} archived ${pluralize(finishCount, "finish", "finishes")}, the legends they brought, and the decklists they registered.`;
    return {
      ...seoHead({
        siteUrl,
        title: `${name} in the Meta Archive`,
        description,
        path,
      }),
      scripts: [
        breadcrumbJsonLd(siteUrl, [
          { name: "Meta Archive", path: "/meta" },
          { name, path },
        ]),
      ],
    };
  },
  loaderDeps: ({ search }) => search,
  // Returns only what head reads: loader data is dehydrated beside the query
  // cache, and returning the whole response would ship it twice.
  loader: async ({ context, params, deps }): Promise<MetaPlayerHeadData> => {
    try {
      const [player, sets] = await Promise.all([
        context.queryClient.query({ ...metaPlayerQueryOptions(params.key), staleTime: "static" }),
        context.queryClient.query({ ...publicSetListQueryOptions, staleTime: "static" }),
        context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
      ]);
      await context.queryClient.query({
        ...metaDecksQueryOptions({
          ...metaScopeQueryFromScope(scopeWithDefaultEra(deps, ERA_ALL), deriveSetEras(sets.sets)),
          player: params.key,
          limit: META_MAX_LIST_PAGE_SIZE,
        }),
        staleTime: "static",
      });
      return { name: player.name, finishCount: player.finishes.length };
    } catch (error) {
      if (isNotFoundSentinel(error)) {
        throw notFound();
      }
      throw error;
    }
  },
  pendingComponent: MetaPlayerPending,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});

function MetaPlayerPending() {
  return (
    <div className={cn(PAGE_PADDING, PAGE_WIDTH.capped, "flex flex-col gap-4 py-4")}>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
