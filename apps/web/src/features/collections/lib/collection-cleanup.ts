// cleanup() rejects while a reader is attached, so evicted stores go through cleanupWhenIdle.
// LocalOnlyCollections have gcTime: 0 and never auto-GC; QueryCollections would only after gcTime.

import type { Collection } from "@tanstack/react-db";

type AnyCollection = Collection<any, any, any, any, any>;

/** Dev-only: traces an orphaned collection's subscriber detach and warns if none occurs within 3s. */
export function markOrphaned(collection: AnyCollection, label: string): void {
  if (!import.meta.env.DEV) {
    return;
  }
  const startedAt = performance.now();
  const initialCount = collection.subscriberCount;
  console.debug(`[orphan] ${label}: orphaned with ${initialCount} subscribers`);

  const offSubs = collection.on("subscribers:change", (event) => {
    console.debug(`[orphan] ${label}: ${event.previousSubscriberCount} → ${event.subscriberCount}`);
  });
  const offCleanup = collection.on("status:cleaned-up", () => {
    const elapsed = Math.round(performance.now() - startedAt);
    console.debug(`[orphan] ${label}: cleaned up after ${elapsed}ms`);
    offSubs();
    offCleanup();
  });

  setTimeout(() => {
    if (collection.subscriberCount > 0) {
      console.warn(
        `[orphan] ${label}: still has ${collection.subscriberCount} subscribers after 3s — possible leak`,
      );
    }
  }, 3000);
}

/** Runs cleanup() once subscriberCount hits 0. Safe to call repeatedly; no-ops after cleanup. */
export function cleanupWhenIdle(collection: AnyCollection): void {
  if (collection.status === "cleaned-up") {
    return;
  }
  if (collection.subscriberCount === 0) {
    void cleanupOrWait(collection);
    return;
  }
  waitForIdle(collection);
}

async function cleanupOrWait(collection: AnyCollection): Promise<void> {
  try {
    await collection.cleanup();
  } catch {
    // A reader that attached first makes cleanup() reject with CollectionHasSubscribersError.
    waitForIdle(collection);
  }
}

function waitForIdle(collection: AnyCollection): void {
  const off = collection.on("subscribers:change", (event) => {
    if (event.subscriberCount > 0) {
      return;
    }
    off();
    void cleanupOrWait(collection);
  });
}
