import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  globalThis.addEventListener("online", onChange);
  globalThis.addEventListener("offline", onChange);
  return () => {
    globalThis.removeEventListener("online", onChange);
    globalThis.removeEventListener("offline", onChange);
  };
}

/** The browser's online flag; true during SSR and hydration so both renders match. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
