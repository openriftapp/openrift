import { createFileRoute } from "@tanstack/react-router";

import { catalogQueryOptions } from "@/features/cards/lib/catalog-queries";
import { loadCollection } from "@/features/collections/lib/collection-load";
import { StageShellFallback } from "@/features/stage/components/stage-shell-fallback";
import { TierListGoneState } from "@/features/stage/components/tier-list-gone-state";
import { stageShowSearchSchema } from "@/features/stage/lib/stage-search";
import { tierListSavesSettled } from "@/features/stage/lib/tier-list-saves";
import { tierListQueryOptions } from "@/features/stage/lib/tier-lists-queries";
import { requireSession, sessionQueryOptions } from "@/lib/auth-session";
import { initQueryOptions } from "@/lib/init-queries";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

export const Route = createFileRoute("/_app/stage_/show")({
  // The deck and tier views read client-held stores through live queries, which
  // have no server snapshot and would render an empty stage during SSR.
  ssr: false,
  staticData: { chrome: "bare" },
  validateSearch: stageShowSearchSchema,
  // Only `?tier=` needs a session; the other sources all run signed out.
  beforeLoad: async ({ context, location, search }) => {
    if (search.tier === undefined) {
      return;
    }
    await requireSession({ context, location });
  },
  loaderDeps: ({ search }) => ({ deck: search.deck, tier: search.tier }),
  // A hover preload must not stand in for the fetch on entry: the builder may have saved since.
  preloadStaleTime: 0,
  loader: async ({ context, deps }) => {
    // Both the deck walk and the ad-hoc queue resolve their cards against the
    // catalog, and the stage reads zone labels off /init.
    await Promise.all([
      context.queryClient.query({ ...catalogQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
    ]);
    if (deps.tier !== undefined) {
      const session = await context.queryClient.query({
        ...sessionQueryOptions(),
        staleTime: "static",
      });
      if (session?.user) {
        await tierListSavesSettled(context.queryClient, deps.tier);
        await notFoundOnSentinel(
          context.queryClient.query({
            ...tierListQueryOptions(session.user.id, deps.tier),
            staleTime: 0,
          }),
        );
      }
    }
    if (deps.deck === undefined) {
      return null;
    }
    // A deck the stores have not loaded resolves to the empty stand-in, which
    // puts a deck named "Deck" holding no cards on screen.
    const { preloadLocalDecks } = await import("@/features/decks/lib/local-decks-collection");
    await preloadLocalDecks();
    const session = await context.queryClient.query({
      ...sessionQueryOptions(),
      staleTime: "static",
    });
    if (!session?.user) {
      return null;
    }
    const { getDeckCardsCollection, getDecksCollection } =
      await import("@/features/decks/lib/decks-collection");
    await Promise.all([
      loadCollection(getDecksCollection(context.queryClient, session.user.id)),
      loadCollection(getDeckCardsCollection(context.queryClient, session.user.id)),
    ]);
    return null;
  },
  // A stage URL is a working link for one creator's recording session.
  head: () => privateSeoHead("Stage"),
  pendingComponent: StageShellFallback,
  notFoundComponent: TierListGoneState,
});
