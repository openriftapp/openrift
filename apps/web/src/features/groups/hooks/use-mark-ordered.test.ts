// @vitest-environment jsdom
import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BuyCartItem } from "@/features/groups/lib/buy-cart";

const collections: { current: CollectionResponse[] | undefined } = { current: [] };
const createCollection = vi.fn();
const addCopies = vi.fn();
const decrementEntries = vi.fn();

vi.mock("@/features/collections/hooks/use-collections", () => ({
  useCollectionsList: () => collections.current,
  useCreateCollection: () => ({ mutateAsync: createCollection }),
}));
vi.mock("@/features/collections/hooks/use-copies", () => ({
  useAddCopies: () => ({ mutateAsync: addCopies }),
}));
vi.mock("@/features/lists/hooks/use-lists", () => ({
  useDecrementListEntries: () => ({ mutateAsync: decrementEntries }),
}));

const { useMarkOrdered } = await import("./use-mark-ordered");

const ITEM: BuyCartItem = { key: "card:c-1", cardId: "c-1", printingId: "p-1", quantity: 1 };

function stubCollection(overrides: Partial<CollectionResponse> = {}): CollectionResponse {
  return {
    id: "col-1",
    name: "Ordered (Marketplace)",
    groupId: null,
    purpose: "marketplace_orders",
    ...overrides,
  } as CollectionResponse;
}

beforeEach(() => {
  collections.current = [];
  createCollection.mockResolvedValue(stubCollection({ id: "col-new" }));
  addCopies.mockResolvedValue([]);
  decrementEntries.mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useMarkOrdered", () => {
  it("creates the marked collection with deck building off when there is none", async () => {
    const { result } = renderHook(() => useMarkOrdered());
    let done = false;
    await act(async () => {
      done = await result.current.markOrdered([ITEM], new Map());
    });
    expect(done).toBe(true);
    expect(createCollection).toHaveBeenCalledWith({
      name: "Ordered (Marketplace)",
      availableForDeckbuilding: false,
      purpose: "marketplace_orders",
    });
    expect(addCopies).toHaveBeenCalledWith({
      copies: [{ printingId: "p-1", collectionId: "col-new" }],
    });
  });

  it("reuses the marked collection even after a rename", async () => {
    collections.current = [stubCollection({ id: "col-existing", name: "Post" })];
    const { result } = renderHook(() => useMarkOrdered());
    expect(result.current.orderedCollection?.id).toBe("col-existing");
    await act(async () => {
      await result.current.markOrdered([ITEM], new Map());
    });
    expect(createCollection).not.toHaveBeenCalled();
    expect(addCopies).toHaveBeenCalledWith({
      copies: [{ printingId: "p-1", collectionId: "col-existing" }],
    });
  });

  it("is not ready until the collections load", () => {
    collections.current = undefined;
    const { result } = renderHook(() => useMarkOrdered());
    expect(result.current.ready).toBe(false);
  });

  it("reports failure and clears the pending flag when adding copies fails", async () => {
    addCopies.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useMarkOrdered());
    let done = true;
    await act(async () => {
      done = await result.current.markOrdered([ITEM], new Map());
    });
    expect(done).toBe(false);
    expect(result.current.pending).toBe(false);
  });
});
