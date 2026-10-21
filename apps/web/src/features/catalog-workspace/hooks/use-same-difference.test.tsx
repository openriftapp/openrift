import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { createStoreResetter } from "@/test/store-helpers";

const state = vi.hoisted(() => ({
  discard: vi.fn(),
  fetch: vi.fn(),
  uncheck: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/features/catalog-workspace/lib/workspace-same-difference", () => ({
  discardSameDifferenceFn: state.discard,
  sameDifferenceQueryOptions: (input: unknown) => ({
    queryKey: ["admin", "workspace", "same-difference", input],
    queryFn: state.fetch,
  }),
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useUncheckCandidateCard: () => ({ mutateAsync: state.uncheck }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const { useDiscardSameDifference, useSameDifference } = await import("./use-same-difference");

const INPUT = { provider: "gallery", field: "might" as const, value: "4" };

let resetStore: () => void;
let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  resetStore = createStoreResetter(useWorkspaceSelectionStore);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  state.discard.mockReset();
  state.fetch.mockReset();
  state.uncheck.mockClear();
  vi.mocked(toast.success).mockClear();
});

afterEach(() => {
  resetStore();
});

describe("useSameDifference", () => {
  it("does not fetch while disabled", () => {
    renderHook(() => useSameDifference(INPUT, false), { wrapper });
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("fetches the count when enabled", async () => {
    state.fetch.mockResolvedValue({ count: 3, candidateCardIds: [], cards: [] });
    const { result } = renderHook(() => useSameDifference(INPUT, true), { wrapper });
    await waitFor(() => expect(result.current.data?.count).toBe(3));
  });
});

describe("useDiscardSameDifference", () => {
  it("discards, invalidates the workspace and offers an undo that unchecks every row", async () => {
    state.discard.mockResolvedValue({ checked: 2, candidateCardIds: ["cc-1", "cc-2"] });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useDiscardSameDifference(), { wrapper });

    act(() => result.current.discard(INPUT, "gallery's might suggestion", { onSuccess }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(state.discard).toHaveBeenCalledWith({ data: INPUT });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "workspace"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "cards"] });
    expect(toast.success).toHaveBeenCalledWith(
      "Discarded gallery's might suggestion on 2 cards",
      expect.anything(),
    );

    const entry = useWorkspaceSelectionStore.getState().popUndo();
    await entry?.undo();
    expect(state.uncheck.mock.calls).toEqual([["cc-1"], ["cc-2"]]);
  });

  it("pushes no undo when nothing was left to discard", async () => {
    state.discard.mockResolvedValue({ checked: 0, candidateCardIds: [] });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useDiscardSameDifference(), { wrapper });

    act(() => result.current.discard(INPUT, "gallery's might suggestion", { onSuccess }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([]);
    expect(toast.success).toHaveBeenCalledWith("Nothing left to discard");
  });
});
