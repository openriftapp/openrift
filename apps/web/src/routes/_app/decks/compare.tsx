import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { DeckPending } from "@/features/decks/components/deck-pending";
import { parseCompareSide, queryDeckLink } from "@/features/decks/lib/deck-compare-side";
import { sessionQueryOptions } from "@/lib/auth-session";
import { initQueryOptions } from "@/lib/init-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

// Not a uuid check: either side may be a local deck id or a `meta:`/`share:`
// deck link, and either may be missing (a comparison opened from a deck menu
// starts with only one deck).
const compareSearchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const Route = createFileRoute("/_app/decks/compare")({
  ssr: false,
  validateSearch: compareSearchSchema,
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Compare decks", noIndex: true }),
  loaderDeps: ({ search }) => ({ from: search.from, to: search.to }),
  // Local decks and deck links need no session; local sides resolve
  // client-side from the store.
  loader: async ({ context, location, deps }) => {
    const { bareLocalDeckId } = await import("@/features/decks/lib/local-deck-sanitize");
    const { isLocalDeck, preloadLocalDecks } =
      await import("@/features/decks/lib/local-decks-collection");
    await Promise.all([
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
      preloadLocalDecks(),
    ]);
    // An old link carries the retired `local:` prefix; it names the same deck.
    if (deps.from !== undefined || deps.to !== undefined) {
      const from = deps.from === undefined ? undefined : bareLocalDeckId(deps.from);
      const to = deps.to === undefined ? undefined : bareLocalDeckId(deps.to);
      if (from !== deps.from || to !== deps.to) {
        throw redirect({ to: "/decks/compare", search: { from, to }, replace: true });
      }
    }
    const sides = [parseCompareSide(deps.from), parseCompareSide(deps.to)];
    const serverIds: string[] = [];
    const links: Promise<unknown>[] = [];
    for (const side of sides) {
      if (side?.kind === "deck" && !isLocalDeck(side.deckId)) {
        serverIds.push(side.deckId);
      } else if (side?.kind === "meta" || side?.kind === "share") {
        links.push(queryDeckLink(context.queryClient, side.kind, side.token));
      }
    }
    try {
      await Promise.all(links);
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        throw notFound();
      }
      throw error;
    }
    if (serverIds.length === 0) {
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
    const userId = session.user.id;
    const { getDeckCardsCollection, getDecksCollection } =
      await import("@/features/decks/lib/decks-collection");
    const decks = getDecksCollection(context.queryClient, userId);
    await Promise.all([
      decks.preload(),
      getDeckCardsCollection(context.queryClient, userId).preload(),
    ]);
    if (serverIds.some((id) => !decks.has(id))) {
      throw notFound();
    }
  },
  pendingComponent: DeckPending,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});
