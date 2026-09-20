import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubCopy } from "@/test/factories";

import { collectionsKeys, copiesKeys } from "./collections-query-keys";

const fetchCopies = vi.hoisted(() => vi.fn());
vi.mock("@/features/collections/lib/copies-query", () => ({ fetchCopies }));

const { getCopiesCollection } = await import("./copies-collection");

const userId = "user-1";
let queryClient: QueryClient;

function reachable(...ids: string[]): void {
  queryClient.setQueryData(
    collectionsKeys.syncedStore(userId),
    ids.map((id) => ({ id })),
  );
}

async function resync(): Promise<void> {
  await queryClient.refetchQueries({ queryKey: copiesKeys.syncedStore(userId), exact: true });
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  fetchCopies.mockReset();
});

afterEach(() => {
  queryClient.clear();
});

describe("the copies store's watermark", () => {
  it("sends the last watermark back when the reachable collections are unchanged", async () => {
    reachable("col-1");
    fetchCopies.mockResolvedValue({ items: [stubCopy({ id: "c1" })], syncedXid: "1000" });
    await getCopiesCollection(queryClient, userId).preload();

    fetchCopies.mockResolvedValue({ items: [], deletedIds: [], syncedXid: "2000" });
    await resync();

    expect(fetchCopies).toHaveBeenLastCalledWith("1000", expect.any(AbortSignal));
  });

  it("takes a full read when the previous read had no reachable set to compare against", async () => {
    fetchCopies.mockResolvedValue({ items: [stubCopy({ id: "c1" })], syncedXid: "1000" });
    await getCopiesCollection(queryClient, userId).preload();

    reachable("col-1");
    fetchCopies.mockResolvedValue({ items: [stubCopy({ id: "c1" })], syncedXid: "2000" });
    await resync();
    expect(fetchCopies).toHaveBeenLastCalledWith(undefined, expect.any(AbortSignal));

    fetchCopies.mockResolvedValue({ items: [], deletedIds: [], syncedXid: "3000" });
    await resync();
    expect(fetchCopies).toHaveBeenLastCalledWith("2000", expect.any(AbortSignal));
  });

  it("takes a full read when a collection becomes reachable, whose copies predate the watermark", async () => {
    reachable("col-1");
    fetchCopies.mockResolvedValue({ items: [stubCopy({ id: "c1" })], syncedXid: "1000" });
    await getCopiesCollection(queryClient, userId).preload();

    reachable("col-1", "col-2");
    fetchCopies.mockResolvedValue({ items: [stubCopy({ id: "c1" })], syncedXid: "2000" });
    await resync();

    expect(fetchCopies).toHaveBeenLastCalledWith(undefined, expect.any(AbortSignal));
  });

  it("drops the copies of a collection that is no longer reachable", async () => {
    reachable("col-1", "col-2");
    fetchCopies.mockResolvedValue({
      items: [
        stubCopy({ id: "c1", collectionId: "col-1" }),
        stubCopy({ id: "c2", collectionId: "col-2" }),
      ],
      syncedXid: "1000",
    });
    const collection = getCopiesCollection(queryClient, userId);
    await collection.preload();

    reachable("col-1");
    fetchCopies.mockResolvedValue({ items: [], deletedIds: [], syncedXid: "2000" });
    await resync();

    expect(collection.toArray.map((row) => row.id)).toEqual(["c1"]);
  });
});
