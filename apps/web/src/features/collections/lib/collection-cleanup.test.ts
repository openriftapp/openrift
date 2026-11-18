import {
  CollectionHasSubscribersError,
  createCollection,
  localOnlyCollectionOptions,
} from "@tanstack/react-db";
import { describe, expect, it, vi } from "vitest";

import { captureHandledError } from "@/lib/report-error";

import { cleanupWhenIdle } from "./collection-cleanup";

vi.mock("@/lib/report-error", () => ({ captureHandledError: vi.fn() }));

interface Stub {
  id: string;
}

function createLocalOnly() {
  return createCollection(
    localOnlyCollectionOptions<Stub>({
      id: `cleanup-test-${crypto.randomUUID()}`,
      getKey: (item) => item.id,
    }),
  );
}

describe("cleanupWhenIdle", () => {
  it("invokes cleanup() immediately when no subscribers are attached", () => {
    const collection = createLocalOnly();
    const cleanupSpy = vi.spyOn(collection, "cleanup");

    cleanupWhenIdle(collection);

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it("defers cleanup() until subscriberCount transitions to 0", async () => {
    const collection = createLocalOnly();
    // localOnly collections start in `idle` and need a subscriber to enter
    // `ready`. Subscribing keeps subscriberCount >= 1.
    const subscription = collection.subscribeChanges(() => {});
    expect(collection.subscriberCount).toBeGreaterThan(0);

    const cleanupSpy = vi.spyOn(collection, "cleanup");
    cleanupWhenIdle(collection);

    expect(cleanupSpy).not.toHaveBeenCalled();

    subscription.unsubscribe();

    await vi.waitFor(() => expect(cleanupSpy).toHaveBeenCalledTimes(1));
  });

  it("waits for the next detach when cleanup() rejects because a reader attached", async () => {
    const collection = createLocalOnly();
    const cleanupSpy = vi
      .spyOn(collection, "cleanup")
      .mockRejectedValueOnce(new CollectionHasSubscribersError(collection.id, 1));

    cleanupWhenIdle(collection);
    await vi.waitFor(() => expect(cleanupSpy).toHaveBeenCalledTimes(1));

    const subscription = collection.subscribeChanges(() => {});
    subscription.unsubscribe();

    await vi.waitFor(() => expect(cleanupSpy).toHaveBeenCalledTimes(2));
  });

  it("reports any other cleanup failure and stops waiting", async () => {
    const collection = createLocalOnly();
    const failure = new Error("adapter cleanup failed");
    const cleanupSpy = vi.spyOn(collection, "cleanup").mockRejectedValueOnce(failure);

    cleanupWhenIdle(collection);
    await vi.waitFor(() =>
      expect(captureHandledError).toHaveBeenCalledWith(failure, {
        collectionCleanup: collection.id,
      }),
    );

    const subscription = collection.subscribeChanges(() => {});
    subscription.unsubscribe();
    await Promise.resolve();

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when called against an already-cleaned-up collection", async () => {
    const collection = createLocalOnly();
    await collection.cleanup();
    expect(collection.status).toBe("cleaned-up");

    const cleanupSpy = vi.spyOn(collection, "cleanup");
    cleanupWhenIdle(collection);
    expect(cleanupSpy).not.toHaveBeenCalled();
  });
});
