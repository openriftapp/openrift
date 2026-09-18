import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { NotFoundFallback, RouteErrorFallback } from "@/components/error-message";
import { parseCompareSide, queryDeckLink } from "@/features/decks/lib/deck-compare-side";
import { deckDetailQueryOptions, decksQueryOptions } from "@/features/decks/lib/decks-queries";
import { isLocalDeckId } from "@/features/decks/lib/local-deck";
import { sessionQueryOptions } from "@/lib/auth-session";
import { initQueryOptions } from "@/lib/init-queries";
import { seoHead } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-config";

// Not a uuid check: either side may be a `local:` id or a `meta:`/`share:` deck
// link, and either may be missing (a comparison opened from a deck menu starts
// with only one deck).
const compareSearchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const Route = createFileRoute("/_app/decks/compare")({
  ssr: "data-only",
  validateSearch: compareSearchSchema,
  head: () => seoHead({ siteUrl: getSiteUrl(), title: "Compare decks", noIndex: true }),
  loaderDeps: ({ search }) => ({ from: search.from, to: search.to }),
  // Local decks and deck links need no session; local sides resolve
  // client-side from the store.
  loader: async ({ context, location, deps }) => {
    await context.queryClient.query({ ...initQueryOptions, staleTime: "static" });
    const sides = [parseCompareSide(deps.from), parseCompareSide(deps.to)];
    const serverIds: string[] = [];
    const links: Promise<unknown>[] = [];
    for (const side of sides) {
      if (side?.kind === "deck" && !isLocalDeckId(side.deckId)) {
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
    try {
      await Promise.all([
        context.queryClient.query({ ...decksQueryOptions(userId), staleTime: "static" }),
        ...serverIds.map((id) =>
          context.queryClient.query({ ...deckDetailQueryOptions(userId, id), staleTime: "static" }),
        ),
      ]);
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        throw notFound();
      }
      throw error;
    }
  },
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFoundFallback,
});
