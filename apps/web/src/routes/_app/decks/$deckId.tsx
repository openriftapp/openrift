import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { cleanedSearchForRedirect, filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { DeckPending } from "@/features/decks/components/deck-pending";
import { sessionQueryOptions } from "@/lib/auth-session";
import { initQueryOptions } from "@/lib/init-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/decks/$deckId")({
  ssr: false,
  validateSearch: filterSearchSchema,
  beforeLoad: ({ search, location, params }) => {
    const cleaned = cleanedSearchForRedirect(filterSearchSchema, search, location.searchStr);
    if (cleaned) {
      throw redirect({
        to: "/decks/$deckId",
        params: { deckId: params.deckId },
        search: cleaned,
        replace: true,
      });
    }
  },
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Deck Editor", noIndex: true }),
  staticData: { hideFooter: true },
  // Auth is optional: a browser-local deck needs no server fetch; a server id
  // with no session redirects to /login, preserving `redirect` for the return.
  loader: async ({ context, params, location }) => {
    const { bareLocalDeckId } = await import("@/features/decks/lib/local-deck-sanitize");
    const { isLocalDeck, preloadLocalDecks } =
      await import("@/features/decks/lib/local-decks-collection");
    await preloadLocalDecks();
    // An old bookmark carries the retired `local:` prefix; it names the same deck.
    const bareId = bareLocalDeckId(params.deckId);
    if (bareId !== params.deckId) {
      if (!isLocalDeck(bareId)) {
        const session = await context.queryClient.query({
          ...sessionQueryOptions(),
          staleTime: "static",
        });
        if (!session?.user) {
          throw notFound();
        }
      }
      throw redirect({
        to: "/decks/$deckId",
        params: { deckId: bareId },
        search: (prev) => prev,
        replace: true,
      });
    }
    if (isLocalDeck(params.deckId)) {
      await context.queryClient.query({ ...initQueryOptions, staleTime: "static" });
      return;
    }
    const session = await context.queryClient.query({
      ...sessionQueryOptions(),
      staleTime: "static",
    });
    if (!session?.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href || undefined, email: undefined },
      });
    }
    const { deckInStore, getDeckCardsCollection, getDecksCollection, refreshDeckStores } =
      await import("@/features/decks/lib/decks-collection");
    const userId = session.user.id;
    await Promise.all([
      getDecksCollection(context.queryClient, userId).preload(),
      getDeckCardsCollection(context.queryClient, userId).preload(),
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
    ]);
    if (!deckInStore(context.queryClient, userId, params.deckId)) {
      // A variant, a clone or another device's deck reaches the store with the next read.
      await refreshDeckStores(context.queryClient, userId);
      if (!deckInStore(context.queryClient, userId, params.deckId)) {
        throw notFound();
      }
    }
  },
  pendingComponent: DeckPending,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});
