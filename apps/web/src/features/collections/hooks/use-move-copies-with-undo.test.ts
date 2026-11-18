import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("@/features/collections/hooks/use-copies", () => ({
  useMoveCopies: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));

const { useMoveCopiesWithUndo } = await import("./use-move-copies-with-undo");

beforeEach(() => {
  mutateAsync.mockReset();
  toastSuccess.mockReset();
});

async function flush() {
  await vi.waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  await Promise.resolve();
  await Promise.resolve();
}

describe("useMoveCopiesWithUndo", () => {
  it("returns each copy to its own previous collection on undo", async () => {
    mutateAsync.mockResolvedValueOnce([
      { copyId: "c1", fromCollectionId: "binder" },
      { copyId: "c2", fromCollectionId: "inbox" },
      { copyId: "c3", fromCollectionId: "binder" },
    ]);
    const onUndone = vi.fn();
    const { result } = renderHook(() => useMoveCopiesWithUndo());

    const moved = await result.current.move(["c1", "c2", "c3"], "dest", onUndone);
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue([]);
    moved?.undo?.onClick();
    await flush();
    await vi.waitFor(() => expect(onUndone).toHaveBeenCalledOnce());

    expect(mutateAsync.mock.calls.map(([input]) => input)).toEqual([
      { copyIds: ["c1", "c3"], toCollectionId: "binder" },
      { copyIds: ["c2"], toCollectionId: "inbox" },
    ]);
    expect(toastSuccess).toHaveBeenCalledWith("Moved 3 cards back");
  });

  it("offers no undo when nothing changed collection", async () => {
    mutateAsync.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useMoveCopiesWithUndo());

    const moved = await result.current.move(["c1"], "dest");

    expect(moved).toEqual({});
  });

  it("resolves undefined when the move fails", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useMoveCopiesWithUndo());

    const moved = await result.current.move(["c1"], "dest");

    expect(moved).toBeUndefined();
  });

  it("skips the moved-back toast when every undo batch fails", async () => {
    mutateAsync.mockResolvedValueOnce([{ copyId: "c1", fromCollectionId: "binder" }]);
    const onUndone = vi.fn();
    const { result } = renderHook(() => useMoveCopiesWithUndo());

    const moved = await result.current.move(["c1"], "dest", onUndone);
    mutateAsync.mockReset();
    mutateAsync.mockRejectedValue(new Error("offline"));
    moved?.undo?.onClick();
    await flush();
    await Promise.resolve();

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onUndone).not.toHaveBeenCalled();
  });
});
