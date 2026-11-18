import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

type StageShowSource = { tier: string } | { tierShare: string } | { deck: string };

/**
 * Loads the stage show's chunks and loader data into memory, so Present still opens it after
 * the connection drops.
 */
export function preloadStageShow(
  router: Pick<ReturnType<typeof useRouter>, "preloadRoute">,
  source: StageShowSource,
): void {
  void router.preloadRoute({ to: "/stage/show", search: { ...source, i: 0 } });
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
