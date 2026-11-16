import { createFileRoute, redirect } from "@tanstack/react-router";

import { cleanedSearchForRedirect } from "@/features/cards/lib/search-schemas";
import { loadCollection } from "@/features/collections/lib/collection-load";
import { DeckPending } from "@/features/decks/components/deck-pending";
import { deckListSearchSchema } from "@/features/decks/lib/deck-list-search";
import { sessionQueryOptions } from "@/lib/auth-session";
import { privateSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/_app/decks/")({
  ssr: false,
  validateSearch: deckListSearchSchema,
  beforeLoad: ({ search, location }) => {
    const cleaned = cleanedSearchForRedirect(deckListSearchSchema, search, location.searchStr, {
      legacySearchToQ: false,
    });
    if (cleaned) {
      throw redirect({ to: "/decks", search: cleaned, replace: true });
    }
  },
  head: () => privateSeoHead("Decks"),
  loader: async ({ context }) => {
    const { preloadLocalDecks } = await import("@/features/decks/lib/local-decks-collection");
    const [session] = await Promise.all([
      context.queryClient.query({
        ...sessionQueryOptions(),
        staleTime: "static",
      }),
      preloadLocalDecks(),
    ]);
    if (session?.user) {
      const { getDeckCardsCollection, getDecksCollection } =
        await import("@/features/decks/lib/decks-collection");
      await Promise.all([
        loadCollection(getDecksCollection(context.queryClient, session.user.id)),
        loadCollection(getDeckCardsCollection(context.queryClient, session.user.id)),
      ]);
    }
  },
  pendingComponent: DeckPending,
});
