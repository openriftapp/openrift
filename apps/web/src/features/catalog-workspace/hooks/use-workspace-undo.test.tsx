import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";
import {
  createWorkspaceWriteQueue,
  resetWorkspaceWriteQueue,
  workspaceWriteQueue,
} from "@/features/catalog-workspace/lib/workspace-write-queue";
import { useWorkspaceUndoStore } from "@/features/catalog-workspace/stores/workspace-undo-store";
import { StaleServerFnError } from "@/lib/stale-server-fn-signal";
import { createStoreResetter } from "@/test/store-helpers";

const reported = vi.hoisted(() => vi.fn());

vi.mock("@/lib/query-client", () => ({ reportMutationError: reported }));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const {
  NOTHING_KNOWN_NOTICE,
  NO_UNDO_NOTICE,
  NOTHING_SAVED_NOTICE,
  runWorkspaceUndo,
  undoLatestWorkspaceStep,
  useWorkspaceUndo,
} = await import("./use-workspace-undo");

let resetStore: () => void;
let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function entry(
  label: string,
  undo: (signal: AbortSignal) => Promise<void> = () => Promise.resolve(),
): WorkspaceUndoEntry {
  return {
    label,
    undoneLabel: `Undone: ${label}`,
    invalidates: [["admin", "workspace"]],
    undo: vi.fn(undo),
  };
}

function stack() {
  return useWorkspaceUndoStore.getState().undoStack;
}

beforeEach(() => {
  resetStore = createStoreResetter(useWorkspaceUndoStore);
  queryClient = new QueryClient();
  vi.spyOn(queryClient, "invalidateQueries");
  reported.mockClear();
  vi.mocked(toast).mockClear();
  vi.mocked(toast.success).mockClear();
});

afterEach(() => {
  resetWorkspaceWriteQueue();
  resetStore();
});

describe("runWorkspaceUndo", () => {
  it("removes the entry once its undo lands, says what was undone and refreshes", async () => {
    const done = entry("Discarded 1 image on Teemo, Scout");
    useWorkspaceUndoStore.getState().pushUndo(done);

    await runWorkspaceUndo(done, queryClient);

    expect(done.undo).toHaveBeenCalledOnce();
    expect(stack()).toEqual([]);
    expect(toast.success).toHaveBeenCalledWith("Undone: Discarded 1 image on Teemo, Scout");
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["admin", "workspace"],
    });
    expect(useWorkspaceUndoStore.getState().undoing).toBe(false);
  });

  it("keeps the entry and reports the error when the undo fails", async () => {
    const failure = Object.assign(new Error("Network down"), { status: 503 });
    const failing = entry("Used Rarity from Provider A on Vi", () => Promise.reject(failure));
    useWorkspaceUndoStore.getState().pushUndo(failing);

    await runWorkspaceUndo(failing, queryClient);

    expect(stack()).toEqual([failing]);
    expect(reported).toHaveBeenCalledWith(failure, queryClient);
    expect(toast.success).not.toHaveBeenCalled();
    expect(useWorkspaceUndoStore.getState().undoing).toBe(false);
  });

  it("drops the entry with a notice when its record no longer exists", async () => {
    const gone = Object.assign(new Error("Candidate printing not found"), { status: 404 });
    const orphan = entry("Discarded 2 suggestions on Vi", () => Promise.reject(gone));
    useWorkspaceUndoStore.getState().pushUndo(orphan);

    await runWorkspaceUndo(orphan, queryClient);

    expect(stack()).toEqual([]);
    expect(reported).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      'Can\'t undo "Discarded 2 suggestions on Vi": it was deleted since',
    );
  });

  it("drops the entry with a notice when the field changed since the accept", async () => {
    const changed = Object.assign(new Error("Changed since, not undone"), {
      status: 409,
      code: "FIELD_CHANGED",
    });
    const stale = entry("Used Artist from scans on Vi", () => Promise.reject(changed));
    useWorkspaceUndoStore.getState().pushUndo(stale);

    await runWorkspaceUndo(stale, queryClient);

    expect(stack()).toEqual([]);
    expect(reported).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Changed since, not undone: "Used Artist from scans on Vi"');
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["admin", "workspace"],
    });
  });

  it("keeps the entry when the 404 comes from a stale client bundle", async () => {
    const stale = new StaleServerFnError("/_serverFn/abc");
    const kept = entry("Ignored Ekko", () => Promise.reject(stale));
    useWorkspaceUndoStore.getState().pushUndo(kept);

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
    useWorkspaceUndoStore.getState().pushUndo(other);
    useWorkspaceUndoStore.getState().pushUndo(slow);

    const first = runWorkspaceUndo(slow, queryClient);
    const second = runWorkspaceUndo(other, queryClient);
    await runWorkspaceUndo(slow, queryClient);
    await runWorkspaceUndo(entry("Never pushed"), queryClient);
    await vi.waitFor(() => expect(slow.undo).toHaveBeenCalledOnce());
    expect(other.undo).not.toHaveBeenCalled();
    gate.open();
    await Promise.all([first, second]);

    expect(slow.undo).toHaveBeenCalledOnce();
    expect(other.undo).toHaveBeenCalledOnce();
    expect(stack()).toEqual([]);
    expect(useWorkspaceUndoStore.getState().undoing).toBe(false);
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
    useWorkspaceUndoStore.getState().pushUndo(older);
    useWorkspaceUndoStore.getState().pushUndo(failing);

    const first = runWorkspaceUndo(failing, queryClient);
    const second = runWorkspaceUndo(older, queryClient);
    await vi.waitFor(() => expect(failing.undo).toHaveBeenCalledOnce());
    gate.fail(Object.assign(new Error("Network down"), { status: 503 }));
    await Promise.all([first, second]);

    expect(older.undo).not.toHaveBeenCalled();
    expect(stack()).toEqual([older, failing]);
    expect(useWorkspaceUndoStore.getState().undoQueue).toEqual([]);
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

  it("waits for a queued write and undoes the entry it adds, leaving older entries alone", async () => {
    const older = entry("Older");
    const landed = entry("Landed");
    const write = { land: () => {} };
    const { result } = renderHook(() => useWorkspaceUndo(), { wrapper });
    act(() => result.current.push(older));
    const queued = workspaceWriteQueue().enqueue(
      Symbol("record"),
      () =>
        new Promise<void>((resolve) => {
          write.land = () => {
            useWorkspaceUndoStore.getState().pushUndo(landed);
            resolve();
          };
        }),
      { queryClient },
    );

    act(() => {
      expect(result.current.undoLatest()).toBe(true);
      expect(result.current.undoLatest()).toBe(true);
    });
    await vi.waitFor(() => expect(workspaceWriteQueue().idle()).toBe(false));
    expect(older.undo).not.toHaveBeenCalled();
    write.land();
    await queued;

    await vi.waitFor(() => expect(workspaceWriteQueue().idle()).toBe(true));
    expect(landed.undo).toHaveBeenCalledOnce();
    expect(older.undo).not.toHaveBeenCalled();
    expect(stack()).toEqual([older]);
    expect(toast).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith(NO_UNDO_NOTICE);
  });

  it("does not call a saved change without an undo step unsaved", async () => {
    const older = entry("Older");
    const { result } = renderHook(() => useWorkspaceUndo(), { wrapper });
    act(() => result.current.push(older));
    void workspaceWriteQueue().enqueue(Symbol("record"), () => Promise.resolve(), { queryClient });

    act(() => {
      result.current.undoLatest();
    });

    await vi.waitFor(() => expect(workspaceWriteQueue().idle()).toBe(true));
    expect(older.undo).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(NO_UNDO_NOTICE);
  });

  it("says nothing was undone when Z waited behind a write that failed", async () => {
    const older = entry("Older");
    const { result } = renderHook(() => useWorkspaceUndo(), { wrapper });
    act(() => result.current.push(older));
    void workspaceWriteQueue().enqueue(
      Symbol("record"),
      () => Promise.reject(new Error("Network down")),
      { queryClient },
    );

    act(() => {
      result.current.undoLatest();
    });

    await vi.waitFor(() => expect(workspaceWriteQueue().idle()).toBe(true));
    expect(older.undo).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(NOTHING_SAVED_NOTICE);
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
    await vi.waitFor(() => expect(newer.undo).toHaveBeenCalledOnce());
    expect(older.undo).not.toHaveBeenCalled();
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

  it("says the result is unknown when Z waited behind a write that got no answer", async () => {
    const controllers: AbortController[] = [];
    const queue = createWorkspaceWriteQueue(() => {
      const controller = new AbortController();
      controllers.push(controller);
      return controller.signal;
    });
    vi.mocked(queryClient.invalidateQueries).mockResolvedValue();
    const older = entry("Older");
    useWorkspaceUndoStore.getState().pushUndo(older);
    void queue.enqueue(
      Symbol("record"),
      (signal) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", resolve);
        }),
      { queryClient },
    );

    expect(undoLatestWorkspaceStep(queryClient, queue)).toBe(true);
    await vi.waitFor(() => expect(controllers).toHaveLength(1));
    controllers[0]?.abort();

    await vi.waitFor(() => expect(queue.idle()).toBe(true));
    expect(older.undo).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(NOTHING_KNOWN_NOTICE);
  });

  it("says the result is unknown when a retried undo finds the change its unanswered first try made", async () => {
    const controllers: AbortController[] = [];
    const queue = createWorkspaceWriteQueue(() => {
      const controller = new AbortController();
      controllers.push(controller);
      return controller.signal;
    });
    vi.mocked(queryClient.invalidateQueries).mockResolvedValue();
    const changed = Object.assign(new Error("Changed since, not undone"), {
      status: 409,
      code: "FIELD_CHANGED",
    });
    let attempts = 0;
    const retried = entry("Used Artist from scans on Vi", (signal) => {
      attempts += 1;
      return attempts === 1
        ? new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("aborted")));
          })
        : Promise.reject(changed);
    });
    useWorkspaceUndoStore.getState().pushUndo(retried);

    const first = runWorkspaceUndo(retried, queryClient, queue);
    await vi.waitFor(() => expect(controllers).toHaveLength(1));
    controllers[0]?.abort();
    await first;
    await vi.waitFor(() => expect(useWorkspaceUndoStore.getState().undoing).toBe(false));
    expect(stack()).toEqual([retried]);

    await runWorkspaceUndo(retried, queryClient, queue);

    expect(stack()).toEqual([]);
    expect(toast).toHaveBeenCalledWith(
      'Undo result unknown: "Used Artist from scans on Vi" changed since an undo that got no answer. The record was reloaded.',
    );
  });
});
