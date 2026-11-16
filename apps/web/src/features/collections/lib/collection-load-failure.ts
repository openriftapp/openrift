import { toast } from "sonner";

import type { AnyCollection } from "@/features/collections/lib/collection-load";
import { isRetryableError } from "@/lib/server-fns/api-error";
import { m } from "@/paraglide/messages.js";

// About 5.5 s in all: an API restart during a release refuses connections for 2 to 5 s.
const STORE_RETRY_DELAYS_MS = [1000, 2000, 2500] as const;

export const STORE_LOAD_RETRY = {
  retry: (failureCount: number, error: unknown) =>
    failureCount < STORE_RETRY_DELAYS_MS.length && isRetryableError(error),
  retryDelay: (attempt: number) =>
    STORE_RETRY_DELAYS_MS[Math.min(attempt, STORE_RETRY_DELAYS_MS.length - 1)] ?? 0,
};

/** Reports a failed first load and retries it from the toast, on tab focus, or when the network returns. */
export function watchFailedLoad(collection: AnyCollection, message: () => string): void {
  if (globalThis.window === undefined) {
    return;
  }
  const toastId = `load-failed:${collection.id}`;
  let failing = false;
  const disarm = () => {
    globalThis.removeEventListener("focus", retry);
    globalThis.removeEventListener("online", retry);
  };
  const arm = () => {
    failing = true;
    globalThis.addEventListener("focus", retry);
    globalThis.addEventListener("online", retry);
    toast.error(message(), {
      id: toastId,
      description: m.sync_load_failed_hint(),
      duration: Number.POSITIVE_INFINITY,
      action: { label: m.common_retry(), onClick: retry },
    });
  };
  const reloadOrRearm = async () => {
    try {
      await collection.reload();
    } catch {
      arm();
    }
  };
  function retry() {
    disarm();
    void reloadOrRearm();
  }
  const settle = () => {
    if (!failing) {
      return;
    }
    failing = false;
    disarm();
    toast.dismiss(toastId);
  };
  collection.on("status:error", arm);
  collection.on("status:ready", settle);
  collection.on("status:cleaned-up", settle);
}
