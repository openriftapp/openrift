/* oxlint-disable unicorn/no-useless-undefined, promise/prefer-await-to-then, unicorn/prefer-top-level-await -- zod's `.catch(undefined)` is a sync fallback, not a Promise#catch */
import type { DeckZone } from "@openrift/shared/types/enums";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { RouteErrorFallback } from "@/components/error-message";
import { catalogQueryOptions } from "@/features/cards/lib/catalog-query";
import { filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { DeckPending } from "@/features/decks/components/deck-pending";
import { queueCardsSearchSchema } from "@/features/stage/lib/presentation-queue-search";
import { sessionQueryOptions } from "@/lib/auth-session";
import { initQueryOptions } from "@/lib/init-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

const DECK_ZONES = [
  "main",
  "sideboard",
  "legend",
  "champion",
  "runes",
  "battlefield",
  "overflow",
] as const satisfies readonly DeckZone[];

// Carries the shared filter params on top of its own: dropping them would
// make a link copied from /cards fail validation here.
const stageSearchSchema = filterSearchSchema.extend({
  deck: z.string().optional().catch(undefined),
  tier: z.string().optional().catch(undefined),
  tierShare: z.string().optional().catch(undefined),
  cards: queueCardsSearchSchema,
  zone: z.enum(DECK_ZONES).optional().catch(undefined),
  i: z.number().int().nonnegative().optional().catch(undefined),
  mode: z.enum(["edit"]).optional().catch(undefined),
  preset: z.string().optional().catch(undefined),
  edit: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute("/_app/stage")({
  // The deck and tier views read client-held stores through live queries, which
  // have no server snapshot and would render an empty stage during SSR.
  ssr: false,
  // Deliberately not indexed: a stage URL is a working link for one creator's
  // recording session, not a page anyone should land on from search.
  head: () =>
    seoHead({
      siteUrl: getSiteUrl(),
      title: "Stage",
      description:
        "Put Riftbound cards on screen: a full-screen show for window capture, and a transparent browser source you push cards to in OBS.",
      path: "/stage",
      noIndex: true,
    }),
  validateSearch: stageSearchSchema,
  // Only `?tier=` needs a session; the other sources all run signed out.
  beforeLoad: async ({ context, location, search }) => {
    if (search.tier === undefined) {
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
  },
  loaderDeps: ({ search }) => ({ deck: search.deck }),
  loader: async ({ context, deps }) => {
    // Both the deck walk and the ad-hoc queue resolve their cards against the
    // catalog, and the stage reads zone labels off /init.
    await Promise.all([
      context.queryClient.query({ ...catalogQueryOptions, staleTime: "static" }),
      context.queryClient.query({ ...initQueryOptions, staleTime: "static" }),
    ]);
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
      getDecksCollection(context.queryClient, session.user.id).preload(),
      getDeckCardsCollection(context.queryClient, session.user.id).preload(),
    ]);
    return null;
  },
  pendingComponent: DeckPending,
  errorComponent: RouteErrorFallback,
});
