import { isAllowedLinkUrl } from "@openrift/shared/link-hosts";
import { createFileRoute } from "@tanstack/react-router";

import { DeckPending } from "@/features/decks/components/deck-pending";
import { sessionQueryOptions } from "@/lib/auth-session";
import { initQueryOptions } from "@/lib/init-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

interface DeckImportSearch {
  replaceDeckId?: string;
  code?: string;
  name?: string;
  source?: string;
}

export const Route = createFileRoute("/_app/decks/import")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): DeckImportSearch => {
    const result: DeckImportSearch = {};
    const replaceDeckId = search.replaceDeckId;
    if (typeof replaceDeckId === "string" && replaceDeckId.length > 0) {
      result.replaceDeckId = replaceDeckId;
    }
    const code = search.code;
    if (typeof code === "string" && code.length > 0) {
      result.code = code;
    }
    const name = search.name;
    if (typeof name === "string") {
      // Clamp to the deck contract's name limit so a hostile link can't
      // produce an unsaveable prefill.
      const trimmed = name.trim().slice(0, 200);
      if (trimmed.length > 0) {
        result.name = trimmed;
      }
    }
    const source = search.source;
    // isAllowedLinkUrl only: this route file loads eagerly on every page,
    // and deckLinkSchema pulls in all of response-schemas.
    if (typeof source === "string" && source.length <= 500 && isAllowedLinkUrl(source)) {
      result.source = source;
    }
    return result;
  },
  loaderDeps: ({ search }) => ({ replaceDeckId: search.replaceDeckId }),
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Import Deck", noIndex: true }),
  // Replace mode only preloads the server stores: a browser-local target lives
  // in the local store, and asking the server about it would 404.
  loader: async ({ context, deps }) => {
    const { isLocalDeck, preloadLocalDecks } =
      await import("@/features/decks/lib/local-decks-collection");
    await Promise.all([
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
      preloadLocalDecks(),
    ]);
    if (deps.replaceDeckId && !isLocalDeck(deps.replaceDeckId)) {
      const session = await context.queryClient.query({
        ...sessionQueryOptions(),
        staleTime: "static",
      });
      if (session?.user) {
        const { getDeckCardsCollection, getDecksCollection } =
          await import("@/features/decks/lib/decks-collection");
        await Promise.all([
          getDecksCollection(context.queryClient, session.user.id).preload(),
          getDeckCardsCollection(context.queryClient, session.user.id).preload(),
        ]);
      }
    }
  },
  pendingComponent: DeckPending,
});
