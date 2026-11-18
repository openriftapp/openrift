import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetWorkspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { createStoreResetter } from "@/test/store-helpers";

const state = vi.hoisted(() => ({
  discard: vi.fn(),
  fetch: vi.fn(),
  uncheck: vi.fn((_input: unknown) => Promise.resolve()),
}));

vi.mock("@/features/catalog-workspace/lib/workspace-same-difference", () => ({
  discardSameDifferenceFn: state.discard,
  sameDifferenceQueryOptions: (input: unknown) => ({
    queryKey: ["admin", "workspace", "same-difference", input],
    queryFn: state.fetch,
  }),
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  uncheckCandidateCardsFn: state.uncheck,
}));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));

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
  resetWorkspaceWriteQueue();
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

    await act(() => result.current.discard(INPUT, "gallery's might suggestion", { onSuccess }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(state.discard).toHaveBeenCalledWith({ data: INPUT });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "workspace"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "cards"] });
    expect(toast.success).toHaveBeenCalledWith(
      "Discarded gallery's might suggestion on 2 cards",
      expect.anything(),
    );

    const entry = useWorkspaceSelectionStore.getState().undoStack.at(-1);
    expect(entry?.undoneLabel).toBe("Undone: gallery's might suggestion restored on 2 cards");
    await entry?.undo();
    expect(state.uncheck.mock.calls).toEqual([[{ data: { candidateCardIds: ["cc-1", "cc-2"] } }]]);
  });

  it("runs two discards clicked before either lands one after the other and pushes an undo for each", async () => {
    const gates: (() => void)[] = [];
    state.discard.mockImplementation(
      ({ data }: { data: typeof INPUT }) =>
        new Promise((resolve) => {
          gates.push(() => resolve({ checked: 1, candidateCardIds: [data.field] }));
        }),
    );
    const { result } = renderHook(() => useDiscardSameDifference(), { wrapper });

    let runs: Promise<boolean>[] = [];
    act(() => {
      runs = [
        result.current.discard(INPUT, "gallery's might suggestion"),
        result.current.discard({ ...INPUT, field: "energy" }, "gallery's energy suggestion"),
      ];
    });
    await waitFor(() => expect(gates).toHaveLength(1));
    await act(async () => gates[0]?.());
    await waitFor(() => expect(gates).toHaveLength(2));
    gates[1]?.();
    await act(() => Promise.all(runs));

    expect(useWorkspaceSelectionStore.getState().undoStack.map((entry) => entry.label)).toEqual([
      "Discarded gallery's might suggestion on 1 card",
      "Discarded gallery's energy suggestion on 1 card",
    ]);
  });

  it("pushes no undo when nothing was left to discard", async () => {
    state.discard.mockResolvedValue({ checked: 0, candidateCardIds: [] });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useDiscardSameDifference(), { wrapper });

    await act(() => result.current.discard(INPUT, "gallery's might suggestion", { onSuccess }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([]);
    expect(toast.success).toHaveBeenCalledWith("Nothing left to discard");
  });
});
