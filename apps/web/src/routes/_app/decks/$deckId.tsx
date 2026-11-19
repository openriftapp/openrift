import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

import { NotFoundFallback } from "@/components/error-message";
import { PagePending } from "@/components/page-pending";
import { customTagsQueryOptions } from "@/features/cards/lib/custom-tags-queries";
import { cleanedSearchForRedirect } from "@/features/cards/lib/search-schemas";
import { loadCollection } from "@/features/collections/lib/collection-load";
import { deckEditorSearchSchema } from "@/features/decks/lib/deck-editor-search";
import { requireSession } from "@/lib/auth-session";
import { initQueryOptions } from "@/lib/init-queries";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/decks/$deckId")({
  ssr: false,
  validateSearch: deckEditorSearchSchema,
  beforeLoad: ({ search, location, params }) => {
    const cleaned = cleanedSearchForRedirect(deckEditorSearchSchema, search, location.searchStr, {
      legacySearchToQ: true,
    });
    if (cleaned) {
      throw redirect({
        to: "/decks/$deckId",
        params: { deckId: params.deckId },
        search: cleaned,
        replace: true,
      });
    }
  },
  head: () => privateSeoHead("Deck Editor"),
  staticData: { hideFooter: true },
  // Auth is optional: a browser-local deck needs no server fetch; a server id
  // with no session redirects to /login, preserving `redirect` for the return.
  loader: async ({ context, params, location }) => {
    const { isLocalDeck, preloadLocalDecks } =
      await import("@/features/decks/lib/local-decks-collection");
    await preloadLocalDecks();
    if (isLocalDeck(params.deckId)) {
      await Promise.all([
        context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
        context.queryClient.query({ ...customTagsQueryOptions, staleTime: "static" }),
      ]);
      return;
    }
    const { userId } = await requireSession({ context, location });
    const { deckInStore, getDeckCardsCollection, getDecksCollection, refreshDeckStores } =
      await import("@/features/decks/lib/decks-collection");
    await Promise.all([
      loadCollection(getDecksCollection(context.queryClient, userId)),
      loadCollection(getDeckCardsCollection(context.queryClient, userId)),
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...customTagsQueryOptions, staleTime: "static" }),
    ]);
    if (!deckInStore(context.queryClient, userId, params.deckId)) {
      // A variant, a clone or another device's deck reaches the store with the next read.
      await refreshDeckStores(context.queryClient, userId);
      if (!deckInStore(context.queryClient, userId, params.deckId)) {
        throw notFound();
      }
    }
  },
  pendingComponent: PagePending,
  notFoundComponent: NotFoundFallback,
});
