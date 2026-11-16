import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";
import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { StaleServerFnError } from "@/lib/stale-server-fn-signal";
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
    const stale = new StaleServerFnError("/_serverFn/abc");
    const kept = entry("Ignored Ekko", () => Promise.reject(stale));
    useWorkspaceSelectionStore.getState().pushUndo(kept);

    await runWorkspaceUndo(kept, queryClient);

    expect(stack()).toEqual([kept]);
    expect(reported).toHaveBeenCalledWith(stale, queryClient);
    expect(toast).not.toHaveBeenCalled();
  });

  it("queues an undo asked for while another runs and skips entries that left the stack", async () => {
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
    await runWorkspaceUndo(slow, queryClient);
    await runWorkspaceUndo(entry("Never pushed"), queryClient);
    expect(other.undo).not.toHaveBeenCalled();
    gate.open();
    await first;

    expect(slow.undo).toHaveBeenCalledOnce();
    expect(other.undo).toHaveBeenCalledOnce();
    expect(stack()).toEqual([]);
    expect(useWorkspaceSelectionStore.getState().undoing).toBe(false);
  });

  it("drops the queued undos when the running one fails", async () => {
    const gate = { fail: (_error: unknown) => {} };
    const failing = entry(
      "Failing",
      () =>
        new Promise<void>((_resolve, reject) => {
          gate.fail = reject;
        }),
    );
    const older = entry("Older");
    useWorkspaceSelectionStore.getState().pushUndo(older);
    useWorkspaceSelectionStore.getState().pushUndo(failing);

    const first = runWorkspaceUndo(failing, queryClient);
    await runWorkspaceUndo(older, queryClient);
    gate.fail(Object.assign(new Error("Network down"), { status: 503 }));
    await first;

    expect(older.undo).not.toHaveBeenCalled();
    expect(stack()).toEqual([older, failing]);
    expect(useWorkspaceSelectionStore.getState().undoQueue).toEqual([]);
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

  it("undoes the next entry down when Z is pressed again before the first undo lands", async () => {
    const gate = { open: () => {} };
    const older = entry("Older");
    const newer = entry(
      "Newer",
      () =>
        new Promise<void>((resolve) => {
          gate.open = resolve;
        }),
    );
    const { result } = renderHook(() => useWorkspaceUndo(), { wrapper });
    act(() => {
      for (const pushed of [older, newer]) {
        result.current.push(pushed);
      }
    });

    act(() => {
      result.current.undoLatest();
      result.current.undoLatest();
    });
    gate.open();

    await vi.waitFor(() => expect(stack()).toEqual([]));
    expect(newer.undo).toHaveBeenCalledOnce();
    expect(older.undo).toHaveBeenCalledOnce();
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
