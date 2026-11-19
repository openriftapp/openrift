import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

type StageRouter = Pick<ReturnType<typeof useRouter>, "preloadRoute">;

/**
 * Loads a deck's stage show and the deck page its exit returns to, code and loader data, so
 * Present and the way back still work after the connection drops.
 */
export function preloadStageShow(router: StageRouter, source: { deck: string }): void {
  void router.preloadRoute({ to: "/stage/show", search: { deck: source.deck, i: 0 } });
  void router.preloadRoute({ to: "/decks/$deckId", params: { deckId: source.deck } });
}

/**
 * Loads only the stage show's code once the page has mounted. A tier list page already holds
 * the data the show's loader reads, which the loader takes from the cache while offline.
 */
export function usePreloadStageShowCode(): void {
  const router = useRouter();
  useEffect(() => {
    void router.loadRouteChunk(router.routesById["/_app/stage_/show"]);
  }, [router]);
}
