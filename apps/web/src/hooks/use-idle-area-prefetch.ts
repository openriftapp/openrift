import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { useScopeEffect } from "@/hooks/use-scope-effect";

// The dynamic import keeps the area hook modules out of the app-shell chunk.
const loadAreaPrefetch = () => import("@/hooks/area-prefetch");

const AREA_ROUTES = ["/cards", "/collections", "/decks"] as const;

export function useIdleAreaPrefetch(userId: string | null) {
  const queryClient = useQueryClient();
  const router = useRouter();
  useScopeEffect(userId, (id) => {
    if (id === null) {
      return;
    }
    let cancelled = false;
    const start = async () => {
      const { prefetchAreas } = await loadAreaPrefetch();
      if (cancelled) {
        return;
      }
      prefetchAreas(queryClient, id);
      void Promise.allSettled(AREA_ROUTES.map((to) => router.preloadRoute({ to })));
    };
    if (typeof requestIdleCallback === "function") {
      const handle = requestIdleCallback(() => void start(), { timeout: 3000 });
      return () => {
        cancelled = true;
        cancelIdleCallback(handle);
      };
    }
    const timer = setTimeout(() => void start(), 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });
}
