import { createFileRoute, redirect } from "@tanstack/react-router";

import { RouteErrorFallback } from "@/components/error-message";
import { cleanedSearchForRedirect } from "@/features/cards/lib/search-schemas";
import { DeckPending } from "@/features/decks/components/deck-pending";
import { deckListSearchSchema } from "@/features/decks/lib/deck-list-search";
import { sessionQueryOptions } from "@/lib/auth-session";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/_app/decks/")({
  ssr: false,
  validateSearch: deckListSearchSchema,
  beforeLoad: ({ search, location }) => {
    const cleaned = cleanedSearchForRedirect(deckListSearchSchema, search, location.searchStr);
    if (cleaned) {
      throw redirect({ to: "/decks", search: cleaned, replace: true });
    }
  },
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Decks", noIndex: true }),
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
        getDecksCollection(context.queryClient, session.user.id).preload(),
        getDeckCardsCollection(context.queryClient, session.user.id).preload(),
      ]);
    }
  },
  pendingComponent: DeckPending,
  errorComponent: RouteErrorFallback,
});
