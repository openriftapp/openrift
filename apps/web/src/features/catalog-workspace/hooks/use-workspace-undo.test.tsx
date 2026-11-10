import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";
import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { createStoreResetter } from "@/test/store-helpers";

const reported = vi.hoisted(() => vi.fn());

vi.mock("@/lib/query-client", () => ({ reportMutationError: reported }));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));

const { runWorkspaceUndo, useWorkspaceUndo } = await import("./use-workspace-undo");

let resetStore: () => void;
let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function entry(
  label: string,
  undo: () => Promise<void> = () => Promise.resolve(),
): WorkspaceUndoEntry {
  return {
    label,
    undoneLabel: `Undone: ${label}`,
    invalidates: [["admin", "workspace"]],
    undo: vi.fn(undo),
  };
}

function stack() {
  return useWorkspaceSelectionStore.getState().undoStack;
}

beforeEach(() => {
  resetStore = createStoreResetter(useWorkspaceSelectionStore);
  queryClient = new QueryClient();
  vi.spyOn(queryClient, "invalidateQueries");
  reported.mockClear();
  vi.mocked(toast).mockClear();
  vi.mocked(toast.success).mockClear();
});

afterEach(() => {
  resetStore();
});

describe("runWorkspaceUndo", () => {
  it("removes the entry once its undo lands, says what was undone and refreshes", async () => {
    const done = entry("Discarded 1 image on Teemo, Scout");
    useWorkspaceSelectionStore.getState().pushUndo(done);

    await runWorkspaceUndo(done, queryClient);

    expect(done.undo).toHaveBeenCalledOnce();
    expect(stack()).toEqual([]);
    expect(toast.success).toHaveBeenCalledWith("Undone: Discarded 1 image on Teemo, Scout");
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["admin", "workspace"],
    });
    expect(useWorkspaceSelectionStore.getState().undoing).toBe(false);
  });

  it("keeps the entry and reports the error when the undo fails", async () => {
    const failure = Object.assign(new Error("Network down"), { status: 503 });
    const failing = entry("Used Rarity from Provider A on Vi", () => Promise.reject(failure));
    useWorkspaceSelectionStore.getState().pushUndo(failing);

    await runWorkspaceUndo(failing, queryClient);

    expect(stack()).toEqual([failing]);
    expect(reported).toHaveBeenCalledWith(failure, queryClient);
    expect(toast.success).not.toHaveBeenCalled();
    expect(useWorkspaceSelectionStore.getState().undoing).toBe(false);
  });

  it("drops the entry with a notice when its record no longer exists", async () => {
    const gone = Object.assign(new Error("Candidate printing not found"), { status: 404 });
    const orphan = entry("Discarded 2 suggestions on Vi", () => Promise.reject(gone));
    useWorkspaceSelectionStore.getState().pushUndo(orphan);

    await runWorkspaceUndo(orphan, queryClient);

    expect(stack()).toEqual([]);
    expect(reported).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      'Can\'t undo "Discarded 2 suggestions on Vi": it was deleted since',
    );
  });

  it("keeps the entry when the 404 comes from a stale client bundle", async () => {
    const stale = Object.assign(new Error("Server function info not found for abc"), {
      status: 404,
    });
    const kept = entry("Ignored Ekko", () => Promise.reject(stale));
    useWorkspaceSelectionStore.getState().pushUndo(kept);

    await runWorkspaceUndo(kept, queryClient);

    expect(stack()).toEqual([kept]);
    expect(reported).toHaveBeenCalledWith(stale, queryClient);
    expect(toast).not.toHaveBeenCalled();
  });

  it("runs one undo at a time and skips entries that left the stack", async () => {
    const gate = { open: () => {} };
    const slow = entry(
      "Slow",
      () =>
        new Promise<void>((resolve) => {
          gate.open = resolve;
        }),
    );
    const other = entry("Other");
    useWorkspaceSelectionStore.getState().pushUndo(other);
    useWorkspaceSelectionStore.getState().pushUndo(slow);

    const first = runWorkspaceUndo(slow, queryClient);
    await runWorkspaceUndo(other, queryClient);
    await runWorkspaceUndo(entry("Never pushed"), queryClient);
    gate.open();
    await first;

    expect(other.undo).not.toHaveBeenCalled();
    expect(stack()).toEqual([other]);
  });
});

describe("useWorkspaceUndo", () => {
  it("undoes the newest entry and reports whether there was one", async () => {
    const older = entry("Older");
    const newer = entry("Newer");
    const { result } = renderHook(() => useWorkspaceUndo(), { wrapper });

    expect(result.current.undoLatest()).toBe(false);
    act(() => {
      for (const pushed of [older, newer]) {
        result.current.push(pushed);
      }
    });
    act(() => {
      expect(result.current.undoLatest()).toBe(true);
    });

    await vi.waitFor(() => expect(stack()).toEqual([older]));
    expect(newer.undo).toHaveBeenCalledOnce();
    expect(older.undo).not.toHaveBeenCalled();
  });

  it("announces an entry with a toast whose Undo runs that entry", async () => {
    const announced = entry("Ignored Ekko");
    const later = entry("Later");
    const { result } = renderHook(() => useWorkspaceUndo(), { wrapper });

    act(() => result.current.announce(announced));
    act(() => result.current.push(later));
    const [label, options] = vi.mocked(toast.success).mock.calls[0] as unknown as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(label).toBe("Ignored Ekko");
    expect(options.action.label).toBe("Undo (Z)");
    act(() => options.action.onClick());

    await vi.waitFor(() => expect(stack()).toEqual([later]));
    expect(announced.undo).toHaveBeenCalledOnce();
    expect(later.undo).not.toHaveBeenCalled();
  });
});
