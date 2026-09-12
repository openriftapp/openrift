import { createLiveQueryCollection } from "@tanstack/react-db";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { copiesKeys } from "@/features/collections/lib/collections-query-keys";
import { stubCopy } from "@/test/factories";

import { getCopiesCollection } from "./copies-collection";

const fetchCopies = vi.hoisted(() => vi.fn());
vi.mock("@/features/collections/lib/copies-query", () => ({ fetchCopies }));

let queryClient: QueryClient;

const userA = "user-a";
const userB = "user-b";

beforeEach(() => {
  fetchCopies.mockReset();
  fetchCopies.mockResolvedValue({ items: [], nextCursor: null });
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(() => {
  queryClient.clear();
});

describe("getCopiesCollection", () => {
  it("returns the same collection for the same (queryClient, userId)", () => {
    const a = getCopiesCollection(queryClient, userA);
    const b = getCopiesCollection(queryClient, userA);
    expect(a).toBe(b);
  });

  it("returns a different collection when the active userId changes", () => {
    const a = getCopiesCollection(queryClient, userA);
    const b = getCopiesCollection(queryClient, userB);
    expect(a).not.toBe(b);
  });

  it("isolates collections across QueryClients", () => {
    const a = getCopiesCollection(queryClient, userA);
    const other = new QueryClient();
    const b = getCopiesCollection(other, userA);
    expect(a).not.toBe(b);
    other.clear();
  });

  it("uses a per-user queryKey so two users' caches never share a slot", () => {
    queryClient.setQueryData(copiesKeys.syncedStore(userA), [{ id: "alice-1" }]);
    queryClient.setQueryData(copiesKeys.syncedStore(userB), [{ id: "bob-1" }]);

    expect(queryClient.getQueryData(copiesKeys.syncedStore(userA))).toEqual([{ id: "alice-1" }]);
    expect(queryClient.getQueryData(copiesKeys.syncedStore(userB))).toEqual([{ id: "bob-1" }]);
  });

  it("refetches on every invalidation instead of reusing a request started before the last write", async () => {
    const copies = getCopiesCollection(queryClient, userA);
    const liveQuery = createLiveQueryCollection({
      query: (q) => q.from({ copy: copies }),
      startSync: true,
    });
    const subscription = liveQuery.subscribeChanges(() => {});
    await vi.waitFor(() => expect(copies.status).toBe("ready"));

    let releaseFirstWrite: (value: { items: unknown[]; nextCursor: null }) => void = () => {};
    // oxlint-disable-next-line promise/avoid-new -- a promise the test resolves by hand to hold the refetch open
    const afterFirstWrite = new Promise<{ items: unknown[]; nextCursor: null }>((resolve) => {
      releaseFirstWrite = resolve;
    });
    fetchCopies.mockReturnValueOnce(afterFirstWrite).mockResolvedValueOnce({
      items: [stubCopy({ id: "c1" }), stubCopy({ id: "c2" })],
      nextCursor: null,
    });
    void queryClient.invalidateQueries({ queryKey: copiesKeys.all(userA) });
    await vi.waitFor(() => expect(fetchCopies).toHaveBeenCalledTimes(2));
    void queryClient.invalidateQueries({ queryKey: copiesKeys.all(userA) });
    releaseFirstWrite({ items: [stubCopy({ id: "c1" })], nextCursor: null });

    await vi.waitFor(() =>
      expect(copies.toArray.map((copy) => copy.id).toSorted()).toEqual(["c1", "c2"]),
    );
    expect(fetchCopies).toHaveBeenCalledTimes(3);

    subscription.unsubscribe();
    await liveQuery.cleanup();
  });

  it("does not surface [Live Query Error] when the active user changes mid-subscription", async () => {
    const aliceCopies = getCopiesCollection(queryClient, userA);

    const liveQuery = createLiveQueryCollection({
      query: (q) => q.from({ copy: aliceCopies }),
      startSync: true,
    });
    const subscription = liveQuery.subscribeChanges(() => {});
    await vi.waitFor(() => expect(aliceCopies.subscriberCount).toBeGreaterThan(0));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      getCopiesCollection(queryClient, userB);

      subscription.unsubscribe();
      await liveQuery.cleanup();

      const liveQueryErrors = errorSpy.mock.calls.filter(
        (call) => typeof call[0] === "string" && call[0].includes("[Live Query Error]"),
      );
      expect(liveQueryErrors).toEqual([]);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
