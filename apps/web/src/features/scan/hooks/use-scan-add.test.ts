import type { CollectionResponse, CopyResponse } from "@openrift/shared/types/api/collection";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetIdCounter, stubCollection, stubCopy, stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const addMock =
  vi.fn<
    (
      printingId: string,
      collectionId: string,
      copyId?: string,
      batchId?: string,
    ) => Promise<CopyResponse>
  >();
const disposeMutateAsync = vi.fn();
vi.mock("@/features/collections/hooks/use-copies", () => ({
  useBatchedAddCopies: () => ({ add: addMock }),
  useDisposeCopies: () => ({ mutateAsync: disposeMutateAsync }),
}));

vi.mock("@/features/groups/hooks/use-wish-entries", () => ({
  useWishEntries: () => ({
    entriesForPrinting: () => [],
    matches: () => false,
    wishedQuantity: () => 0,
  }),
}));

const { useScanSessionStore } = await import("@/features/scan/stores/scan-session-store");
const { useScanAdd } = await import("./use-scan-add");

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useScanSessionStore);
  resetIdCounter();
  addMock.mockReset();
  disposeMutateAsync.mockReset();
});

afterEach(() => {
  resetStore();
});

function collections(): CollectionResponse[] {
  return [stubCollection({ id: "col-1", name: "Trades" })];
}

describe("useScanAdd", () => {
  it("hands each job to add with the job id and one shared batch id", async () => {
    addMock.mockImplementation((printingId, collectionId, copyId) =>
      Promise.resolve(stubCopy({ id: copyId, printingId, collectionId })),
    );
    const printingA = stubPrinting({ id: "printing-a" });
    const printingB = stubPrinting({ id: "printing-b" });
    useScanSessionStore.getState().add(printingA);
    useScanSessionStore.getState().add(printingB);
    useScanSessionStore.getState().add(printingB);
    const { result } = renderHook(() => useScanAdd(collections()));

    await act(async () => {
      await result.current.addAll("col-1");
    });

    expect(addMock).toHaveBeenCalledTimes(3);
    const batchIds = new Set(addMock.mock.calls.map((call) => call[3]));
    expect(batchIds.size).toBe(1);
    const jobIds = new Set(addMock.mock.calls.map((call) => call[2]));
    expect(jobIds.size).toBe(3);
    for (const call of addMock.mock.calls) {
      expect(call[1]).toBe("col-1");
    }
    expect(new Set(addMock.mock.calls.map((call) => call[0]))).toEqual(
      new Set(["printing-a", "printing-b"]),
    );
  });

  it("counts a rejected add as failed while the other jobs still settle", async () => {
    addMock.mockImplementation((printingId, collectionId, copyId) =>
      printingId === "printing-bad"
        ? Promise.reject(new Error("network error"))
        : Promise.resolve(stubCopy({ id: copyId, printingId, collectionId })),
    );
    const good = stubPrinting({ id: "printing-good" });
    const bad = stubPrinting({ id: "printing-bad" });
    useScanSessionStore.getState().add(good);
    useScanSessionStore.getState().add(bad);
    const { result } = renderHook(() => useScanAdd(collections()));

    await act(async () => {
      await result.current.addAll("col-1");
    });

    expect(addMock).toHaveBeenCalledTimes(2);
    expect(result.current.failedCount).toBe(1);
    expect(result.current.adding).toBe(false);
  });

  it("is a no-op with nothing queued to add", async () => {
    const { result } = renderHook(() => useScanAdd(collections()));

    await act(async () => {
      await result.current.addAll("col-1");
    });

    expect(addMock).not.toHaveBeenCalled();
    expect(result.current.adding).toBe(false);
    expect(result.current.failedCount).toBe(0);
  });
});
