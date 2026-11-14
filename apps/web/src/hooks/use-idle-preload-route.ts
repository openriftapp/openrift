import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

export function useIdlePreloadRoute(to: "/cards") {
  const router = useRouter();
  useEffect(() => {
    // Not under `vite dev`: preloadRoute pulls the whole module graph one request at a time there.
    // MODE, not DEV: vitest sets DEV too.
    if (typeof requestIdleCallback === "undefined" || import.meta.env.MODE === "development") {
      return;
    }
    const handle = requestIdleCallback(() => {
      void router.preloadRoute({ to });
    });
    return () => cancelIdleCallback(handle);
  }, [router, to]);
}
