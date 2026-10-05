import { useSyncExternalStore } from "react";

/**
 * A hook tracking `query`. `serverValue` is the SSR and first-hydration value,
 * so pick the one whose markup is safe to show before the client corrects it.
 */
export function createMediaQueryHook(query: string, serverValue: boolean): () => boolean {
  let mql: MediaQueryList | null | undefined;
  const getMql = (): MediaQueryList | null => {
    if (mql === undefined) {
      mql = typeof globalThis.matchMedia === "function" ? globalThis.matchMedia(query) : null;
    }
    return mql;
  };
  const subscribe = (onChange: () => void): (() => void) => {
    const list = getMql();
    list?.addEventListener("change", onChange);
    return () => list?.removeEventListener("change", onChange);
  };
  const getSnapshot = (): boolean => getMql()?.matches ?? serverValue;
  const getServerSnapshot = (): boolean => serverValue;
  function useMediaQuery(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  }
  return useMediaQuery;
}
