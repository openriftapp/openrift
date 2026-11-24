import { noop } from "@openrift/shared/noop";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => noop;

/** Returns true once the client has hydrated; always false during SSR. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
