import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetWorkspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
import { useWorkspaceUndoStore } from "@/features/catalog-workspace/stores/workspace-undo-store";
import { createStoreResetter } from "@/test/store-helpers";

const mocks = vi.hoisted(() => ({
  save: vi.fn((_input: unknown, _options?: unknown) => Promise.resolve()),
  unmap: vi.fn((_input: unknown, _options?: unknown) => Promise.resolve()),
  unmapFn: vi.fn((_input: unknown) => Promise.resolve()),
  saveFn: vi.fn((..._args: unknown[]) => Promise.resolve()),
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  unmapMarketplacePrintingFn: mocks.unmapFn,
  useUnmapMarketplacePrinting: () => ({ mutateAsync: mocks.unmap, isPending: false }),
}));
vi.mock("@/features/admin/hooks/use-unified-mappings", () => {
  const save = { mutateAsync: mocks.save, isPending: false };
  return {
    saveUnifiedMappings: mocks.saveFn,
    useSaveMappingsByMarketplace: () => ({
      tcgplayer: save,
      cardmarket: save,
      cardtrader: save,
      cardnexus: save,
    }),
  };
});
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));

const { useListingWrites } = await import("./use-listing-writes");

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const assignment = { externalId: 4242, finish: "foil", language: "EN", printingId: "p-1" };
let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useWorkspaceUndoStore);
  mocks.unmapFn.mockClear();
  mocks.saveFn.mockClear();
});

afterEach(() => {
  resetWorkspaceWriteQueue();
  resetStore();
});

describe("useListingWrites", () => {
  it("maps a listing with an undo that unmaps it again", async () => {
    const { result } = renderHook(() => useListingWrites("jinx", "Jinx"), { wrapper });

    await act(() => result.current.map("tcgplayer", assignment, "OGN-030"));

    const [entry] = useWorkspaceUndoStore.getState().undoStack;
    expect(entry?.label).toBe("Mapped #4242 to OGN-030 on Jinx");
    const { signal } = new AbortController();
    await entry?.undo(signal);
    expect(mocks.unmapFn).toHaveBeenCalledWith({
      data: { marketplace: "tcgplayer", ...assignment },
      signal,
    });
  });

  it("unmaps a listing with an undo that maps it back", async () => {
    const { result } = renderHook(() => useListingWrites("jinx", "Jinx"), { wrapper });

    await act(() => result.current.unmap("cardmarket", [assignment]));

    const [entry] = useWorkspaceUndoStore.getState().undoStack;
    const { signal } = new AbortController();
    await entry?.undo(signal);
    expect(mocks.saveFn).toHaveBeenCalledWith("cardmarket", [assignment], signal);
  });
});
