import type { TierRow } from "@openrift/shared/types/api/tier-list";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface MutateOptions {
  onSuccess?: () => void;
}

interface MutateBody {
  id: string;
  tiers: TierRow[];
}

const { mutation } = vi.hoisted(() => ({
  mutation: {
    mutate: vi.fn((_body: MutateBody, options?: MutateOptions) => options?.onSuccess?.()),
    isPending: false,
    isError: false,
  },
}));

vi.mock("@/features/stage/hooks/use-tier-lists", () => ({ useUpdateTierList: () => mutation }));

const { useTierListAutosave, AUTOSAVE_WAIT_MS } = await import("./use-tier-list-autosave");
const { useTierListBuilderStore } = await import("@/features/stage/stores/tier-list-builder-store");
const { createStoreResetter } = await import("@/test/store-helpers");

const resetStore = createStoreResetter(useTierListBuilderStore);

const LIST_ID = "list-1";
const BOARD: TierRow[] = [
  { label: "S", cards: [] },
  { label: "A", cards: [] },
];

function loadBoard(listId = LIST_ID) {
  act(() => useTierListBuilderStore.getState().adopt(listId, BOARD));
}

function settle() {
  act(() => {
    vi.advanceTimersByTime(AUTOSAVE_WAIT_MS + 50);
  });
}

function lastSavedRows(): TierRow[] | undefined {
  return mutation.mutate.mock.calls.at(-1)?.[0].tiers;
}

beforeEach(() => {
  vi.useFakeTimers();
  resetStore();
  mutation.isPending = false;
  mutation.isError = false;
  mutation.mutate.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useTierListAutosave", () => {
  it("saves the board once the drags stop", () => {
    renderHook(() => useTierListAutosave(LIST_ID));
    loadBoard();

    act(() => useTierListBuilderStore.getState().assign("card-1", 0));
    act(() => useTierListBuilderStore.getState().assign("card-2", 1));
    expect(mutation.mutate).not.toHaveBeenCalled();

    settle();

    expect(mutation.mutate).toHaveBeenCalledTimes(1);
    expect(lastSavedRows()?.[0]?.cards).toEqual([{ cardId: "card-1", printingId: null }]);
    expect(lastSavedRows()?.[1]?.cards).toEqual([{ cardId: "card-2", printingId: null }]);
  });

  it("sends nothing when the draft only just arrived from the server", () => {
    renderHook(() => useTierListAutosave(LIST_ID));
    loadBoard();

    settle();

    expect(mutation.mutate).not.toHaveBeenCalled();
  });

  it("clears the unsaved flag when the save lands", () => {
    renderHook(() => useTierListAutosave(LIST_ID));
    loadBoard();

    act(() => useTierListBuilderStore.getState().assign("card-1", 0));
    settle();

    expect(useTierListBuilderStore.getState().dirty).toBe(false);
  });

  it("keeps the board unsaved when a drag lands while the save is in flight", () => {
    let finish: (() => void) | undefined;
    mutation.mutate.mockImplementationOnce((_body, options) => {
      finish = () => options?.onSuccess?.();
    });
    renderHook(() => useTierListAutosave(LIST_ID));
    loadBoard();

    act(() => useTierListBuilderStore.getState().assign("card-1", 0));
    settle();
    act(() => useTierListBuilderStore.getState().assign("card-2", 1));
    act(() => finish?.());

    expect(useTierListBuilderStore.getState().dirty).toBe(true);
  });

  it("ignores a draft that belongs to another list", () => {
    renderHook(() => useTierListAutosave(LIST_ID));
    loadBoard("other-list");

    act(() => useTierListBuilderStore.getState().assign("card-1", 0));
    settle();

    expect(mutation.mutate).not.toHaveBeenCalled();
  });

  it("sends a queued save straight away on leaving", () => {
    const { result } = renderHook(() => useTierListAutosave(LIST_ID));
    loadBoard();

    act(() => useTierListBuilderStore.getState().assign("card-1", 0));
    act(() => result.current.leave());

    expect(mutation.mutate).toHaveBeenCalledTimes(1);
    expect(lastSavedRows()?.[0]?.cards).toHaveLength(1);
  });

  it("sends a failed save again on leaving", () => {
    mutation.mutate.mockImplementationOnce(() => {
      mutation.isError = true;
    });
    const { result, rerender } = renderHook(() => useTierListAutosave(LIST_ID));
    loadBoard();

    act(() => useTierListBuilderStore.getState().assign("card-1", 0));
    settle();
    rerender();
    expect(result.current.status).toBe("failed");

    act(() => result.current.leave());

    expect(mutation.mutate).toHaveBeenCalledTimes(2);
    expect(lastSavedRows()?.[0]?.cards).toEqual([{ cardId: "card-1", printingId: null }]);
  });

  it("sends nothing on leaving a saved board", () => {
    const { result } = renderHook(() => useTierListAutosave(LIST_ID));
    loadBoard();

    act(() => result.current.leave());

    expect(mutation.mutate).not.toHaveBeenCalled();
  });

  it("flushes on unmount with the board as it was when the save was queued", () => {
    const { unmount } = renderHook(() => useTierListAutosave(LIST_ID));
    loadBoard();

    act(() => useTierListBuilderStore.getState().assign("card-1", 0));
    act(() => useTierListBuilderStore.getState().reset());
    unmount();

    expect(mutation.mutate).toHaveBeenCalledTimes(1);
    expect(lastSavedRows()?.[0]?.cards).toEqual([{ cardId: "card-1", printingId: null }]);
  });

  it("reports the board as saving until the server has it", () => {
    const { result } = renderHook(() => useTierListAutosave(LIST_ID));
    loadBoard();
    expect(result.current.status).toBe("saved");

    act(() => useTierListBuilderStore.getState().assign("card-1", 0));
    expect(result.current.status).toBe("saving");

    settle();
    expect(result.current.status).toBe("saved");
  });

  it("reports a failed save and sends the current board again on retry", () => {
    mutation.mutate.mockImplementationOnce(() => {
      mutation.isError = true;
    });
    const { result, rerender } = renderHook(() => useTierListAutosave(LIST_ID));
    loadBoard();

    act(() => useTierListBuilderStore.getState().assign("card-1", 0));
    settle();
    rerender();
    expect(result.current.status).toBe("failed");

    mutation.isError = false;
    act(() => result.current.retry());

    expect(mutation.mutate).toHaveBeenCalledTimes(2);
    expect(lastSavedRows()?.[0]?.cards).toEqual([{ cardId: "card-1", printingId: null }]);
    expect(useTierListBuilderStore.getState().dirty).toBe(false);
  });

  it("does not retry when nothing is left unsaved", () => {
    const { result } = renderHook(() => useTierListAutosave(LIST_ID));
    loadBoard();

    act(() => result.current.retry());

    expect(mutation.mutate).not.toHaveBeenCalled();
  });

  it("saves a queued draft under the list it was made on after the stage switches lists", () => {
    const { rerender, unmount } = renderHook(({ id }) => useTierListAutosave(id), {
      initialProps: { id: LIST_ID },
    });
    loadBoard();

    act(() => useTierListBuilderStore.getState().assign("card-1", 0));
    rerender({ id: "list-2" });
    unmount();

    expect(mutation.mutate).toHaveBeenCalledTimes(1);
    expect(mutation.mutate.mock.calls[0]?.[0].id).toBe(LIST_ID);
  });
});
