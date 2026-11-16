import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod/mini";

import { NotFoundFallback } from "@/components/error-message";
import { loadCollection } from "@/features/collections/lib/collection-load";
import { DeckPending } from "@/features/decks/components/deck-pending";
import { parseCompareSide, queryDeckLink } from "@/features/decks/lib/deck-compare-side";
import { requireSession } from "@/lib/auth-session";
import { initQueryOptions } from "@/lib/init-queries";
import { lenient } from "@/lib/lenient-param";
import { privateSeoHead } from "@/lib/seo";
import { notFoundOnSentinel } from "@/lib/server-fns/api-error";

// Not a uuid check: either side may be a local deck id or a `meta:`/`share:`
// deck link, and either may be missing (a comparison opened from a deck menu
// starts with only one deck).
const compareSearchSchema = z.object({
  from: lenient(z.string()),
  to: lenient(z.string()),
});

export const Route = createFileRoute("/_app/decks/compare")({
  ssr: false,
  validateSearch: compareSearchSchema,
  loaderDeps: ({ search }) => ({ from: search.from, to: search.to }),
  // Local decks and deck links need no session; local sides resolve
  // client-side from the store.
  loader: async ({ context, location, deps }) => {
    const { isLocalDeck, preloadLocalDecks } =
      await import("@/features/decks/lib/local-decks-collection");
    await Promise.all([
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
      preloadLocalDecks(),
    ]);
    const sides = [parseCompareSide(deps.from), parseCompareSide(deps.to)];
    const serverIds: string[] = [];
    const links: Promise<unknown>[] = [];
    for (const side of sides) {
      if (side?.kind === "deck" && !isLocalDeck(side.deckId)) {
        serverIds.push(side.deckId);
      } else if (side?.kind === "meta" || side?.kind === "share") {
        links.push(queryDeckLink(context.queryClient, side.kind, side.token, "static"));
      }
    }
    await notFoundOnSentinel(Promise.all(links));
    if (serverIds.length === 0) {
      return;
    }
    const { userId } = await requireSession({ context, location });
    const { getDeckCardsCollection, getDecksCollection } =
      await import("@/features/decks/lib/decks-collection");
    const decks = getDecksCollection(context.queryClient, userId);
    await Promise.all([
      loadCollection(decks),
      loadCollection(getDeckCardsCollection(context.queryClient, userId)),
    ]);
    if (serverIds.some((id) => !decks.has(id))) {
      throw notFound();
    }
  },
  head: () => privateSeoHead("Compare decks"),
  pendingComponent: DeckPending,
  notFoundComponent: NotFoundFallback,
});
