import type { Collection } from "@tanstack/react-db";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";

type AnyCollection = Collection<any, any, any, any, any>;

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
