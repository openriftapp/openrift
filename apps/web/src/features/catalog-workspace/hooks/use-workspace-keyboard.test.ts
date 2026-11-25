import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import {
  createWorkspaceWriteQueue,
  resetWorkspaceWriteQueue,
  LONG_TIMEOUT_MS,
  WRITE_TIMEOUT_MS,
} from "@/features/catalog-workspace/lib/workspace-write-queue";
import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { createStoreResetter } from "@/test/store-helpers";

const navigation = {
  goNext: vi.fn(),
  goPrev: vi.fn(),
};

const notice = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast: Object.assign(notice, { success: vi.fn() }) }));

const {
  RECORD_LOADING_NOTICE,
  STILL_SAVING_NOTICE,
  handleWorkspaceKey,
  useWorkspaceKeyboard,
  workspaceKeyAction,
} = await import("./use-workspace-keyboard");

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: new QueryClient() }, children);
}

function keyEvent(key: string, overrides: Partial<KeyboardEvent> = {}) {
  return {
    key,
    target: document.body,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    defaultPrevented: false,
    ...overrides,
  };
}

function deps(overrides: Partial<Parameters<typeof handleWorkspaceKey>[1]> = {}) {
  return {
    goNext: vi.fn(),
    goPrev: vi.fn(),
    actions: null,
    record: null,
    stale: false,
    currentRecord: () => null,
    undo: vi.fn(() => false),
    overlayOpen: () => false,
    queue: createWorkspaceWriteQueue(),
    queryClient: new QueryClient(),
    ...overrides,
  };
}

let resetActions: () => void;
let resetSelection: () => void;

beforeEach(() => {
  resetActions = createStoreResetter(useWorkspaceActionsStore);
  resetSelection = createStoreResetter(useWorkspaceSelectionStore);
  vi.clearAllMocks();
});

afterEach(() => {
  resetWorkspaceWriteQueue();
  resetActions();
  resetSelection();
  document.body.innerHTML = "";
});

describe("workspaceKeyAction", () => {
  it("maps the bound keys, upper or lower case", () => {
    expect(workspaceKeyAction(keyEvent("j"))).toEqual({ action: "next" });
    expect(workspaceKeyAction(keyEvent("K"))).toEqual({ action: "previous" });
    expect(workspaceKeyAction(keyEvent("Enter"))).toEqual({ action: "settle-and-next" });
  });

  it("ignores modified keys and unbound keys", () => {
    expect(workspaceKeyAction(keyEvent("j", { metaKey: true }))).toBeNull();
    expect(workspaceKeyAction(keyEvent("k", { ctrlKey: true }))).toBeNull();
    expect(workspaceKeyAction(keyEvent("q"))).toBeNull();
    expect(workspaceKeyAction(keyEvent("3"))).toBeNull();
    expect(workspaceKeyAction(keyEvent("0"))).toBeNull();
  });

  it("ignores keys typed into a field", () => {
    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    expect(workspaceKeyAction(keyEvent("j", { target: input }))).toBeNull();
    expect(
      workspaceKeyAction(keyEvent("x", { target: document.createElement("textarea") })),
    ).toBeNull();
    expect(workspaceKeyAction(keyEvent("a", { target: editable }))).toBeNull();
  });

  it("leaves Enter on a focused button to the button", () => {
    const button = document.createElement("button");
    expect(workspaceKeyAction(keyEvent("Enter", { target: button }))).toBeNull();
    expect(workspaceKeyAction(keyEvent("j", { target: button }))).toEqual({ action: "next" });
  });
});

describe("handleWorkspaceKey", () => {
  it("moves with J and K", () => {
    const d = deps();
    expect(handleWorkspaceKey(keyEvent("j"), d)).toBe(true);
    expect(handleWorkspaceKey(keyEvent("k"), d)).toBe(true);
    expect(d.goNext).toHaveBeenCalledOnce();
    expect(d.goPrev).toHaveBeenCalledOnce();
  });

  it("does nothing while a dialog is open", () => {
    const d = deps({ overlayOpen: () => true });
    expect(handleWorkspaceKey(keyEvent("j"), d)).toBe(false);
    expect(d.goNext).not.toHaveBeenCalled();
  });

  it("runs the primary action, then opens the next item", async () => {
    const order: string[] = [];
    const goNext = vi.fn(() => order.push("next"));
    const run = vi.fn(async () => {
      order.push("run");
    });
    handleWorkspaceKey(
      keyEvent("Enter"),
      deps({ goNext, actions: { primary: { label: "Discard", run } } }),
    );
    await vi.waitFor(() => expect(goNext).toHaveBeenCalledOnce());
    expect(order).toEqual(["run", "next"]);
  });

  it("stays on the item when the primary action fails", async () => {
    const goNext = vi.fn();
    const run = vi.fn(() => Promise.reject(new Error("nope")));
    handleWorkspaceKey(
      keyEvent("Enter"),
      deps({ goNext, actions: { primary: { label: "Discard", run } } }),
    );
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(goNext).not.toHaveBeenCalled();
  });

  it("does not run a disabled primary action", () => {
    const run = vi.fn();
    const d = deps({ actions: { primary: { label: "Discard", disabled: true, run } } });
    expect(handleWorkspaceKey(keyEvent("Enter"), d)).toBe(true);
    expect(run).not.toHaveBeenCalled();
    expect(d.goNext).not.toHaveBeenCalled();
  });

  it("treats Enter as Next when the record registered no primary action", () => {
    const d = deps();
    handleWorkspaceKey(keyEvent("Enter"), d);
    expect(d.goNext).toHaveBeenCalledOnce();
  });

  it("ignores auto-repeat for actions but keeps it for moving", () => {
    const run = vi.fn();
    const d = deps({ actions: { primary: { label: "Discard", run } } });
    handleWorkspaceKey(keyEvent("Enter", { repeat: true }), d);
    handleWorkspaceKey(keyEvent("j", { repeat: true }), d);
    expect(run).not.toHaveBeenCalled();
    expect(d.goNext).toHaveBeenCalledOnce();
  });

  it("calls accept, ignore and dismiss all", async () => {
    const accept = vi.fn();
    const ignore = vi.fn();
    const dismissAll = vi.fn();
    const d = deps({ actions: { accept, ignore, dismissAll } });
    handleWorkspaceKey(keyEvent("a"), d);
    await vi.waitFor(() => expect(d.queue.idle()).toBe(true));
    handleWorkspaceKey(keyEvent("x"), d);
    await vi.waitFor(() => expect(d.queue.idle()).toBe(true));
    handleWorkspaceKey(keyEvent("d"), d);
    await vi.waitFor(() => expect(d.queue.idle()).toBe(true));
    expect(accept).toHaveBeenCalledOnce();
    expect(ignore).toHaveBeenCalledOnce();
    expect(dismissAll).toHaveBeenCalledOnce();
  });

  it("leaves D alone on a record with nothing to dismiss", () => {
    expect(handleWorkspaceKey(keyEvent("d"), deps({ actions: {} }))).toBe(false);
  });

  it("gives accept the limit its record registered", async () => {
    const limits: number[] = [];
    const queue = createWorkspaceWriteQueue((ms) => {
      limits.push(ms);
      return new AbortController().signal;
    });
    const accept = vi.fn();
    handleWorkspaceKey(keyEvent("a"), deps({ queue, actions: { accept, acceptLimit: "upload" } }));
    await vi.waitFor(() => expect(queue.idle()).toBe(true));
    handleWorkspaceKey(keyEvent("a"), deps({ queue, actions: { accept } }));
    await vi.waitFor(() => expect(queue.idle()).toBe(true));

    expect(accept).toHaveBeenCalledTimes(2);
    expect(limits).toEqual([LONG_TIMEOUT_MS, WRITE_TIMEOUT_MS]);
  });

  it("runs a repeated action on the same record once and says it is still saving", async () => {
    let finish = () => {};
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const accept = vi.fn();
    const d = deps({ actions: { primary: { label: "Discard", run }, accept } });

    expect(handleWorkspaceKey(keyEvent("Enter"), d)).toBe(true);
    expect(handleWorkspaceKey(keyEvent("Enter"), d)).toBe(true);
    expect(handleWorkspaceKey(keyEvent("a"), d)).toBe(true);
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    expect(accept).not.toHaveBeenCalled();
    expect(notice).toHaveBeenCalledTimes(2);
    expect(notice).toHaveBeenCalledWith(STILL_SAVING_NOTICE);

    finish();
    await vi.waitFor(() => expect(d.queue.idle()).toBe(true));
    handleWorkspaceKey(keyEvent("Enter"), d);
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    finish();
  });

  it("queues an action on another record behind a pending write and runs both in order", async () => {
    const order: string[] = [];
    let finish = () => {};
    const ignoreA = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          order.push("start A");
          finish = () => {
            order.push("end A");
            resolve();
          };
        }),
    );
    const ignoreB = vi.fn(() => {
      order.push("B");
    });
    const queue = createWorkspaceWriteQueue();
    const goNext = vi.fn();

    handleWorkspaceKey(
      keyEvent("x"),
      deps({ queue, record: Symbol("A"), actions: { ignore: ignoreA } }),
    );
    expect(handleWorkspaceKey(keyEvent("j"), deps({ queue, goNext }))).toBe(true);
    expect(goNext).toHaveBeenCalledOnce();
    handleWorkspaceKey(
      keyEvent("x"),
      deps({ queue, record: Symbol("B"), actions: { ignore: ignoreB } }),
    );
    await vi.waitFor(() => expect(ignoreA).toHaveBeenCalledOnce());
    expect(ignoreB).not.toHaveBeenCalled();

    finish();
    await vi.waitFor(() => expect(queue.idle()).toBe(true));
    expect(order).toEqual(["start A", "end A", "B"]);
    expect(notice).not.toHaveBeenCalled();
  });

  it("does not open the next item when the record changed while the primary action waited", async () => {
    const record = Symbol("A");
    let current: symbol | null = record;
    let finish = () => {};
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const d = deps({
      record,
      currentRecord: () => current,
      actions: { primary: { label: "Discard", run } },
    });
    handleWorkspaceKey(keyEvent("Enter"), d);
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    current = Symbol("B");
    finish();
    await vi.waitFor(() => expect(d.queue.idle()).toBe(true));
    expect(d.goNext).not.toHaveBeenCalled();
  });

  it("frees the keys again after an action fails", async () => {
    const ignore = vi.fn(() => Promise.reject(new Error("nope")));
    const d = deps({ actions: { ignore } });
    handleWorkspaceKey(keyEvent("x"), d);
    await vi.waitFor(() => expect(d.queue.idle()).toBe(true));
    handleWorkspaceKey(keyEvent("x"), d);
    await vi.waitFor(() => expect(ignore).toHaveBeenCalledTimes(2));
  });

  it("says the record is still saving when it stopped offering the action during its write", async () => {
    let finish = () => {};
    const ignore = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const record = Symbol("listing");
    const queue = createWorkspaceWriteQueue();

    handleWorkspaceKey(keyEvent("x"), deps({ queue, record, actions: { ignore } }));
    expect(handleWorkspaceKey(keyEvent("x"), deps({ queue, record, actions: {} }))).toBe(true);

    expect(notice).toHaveBeenCalledExactlyOnceWith(STILL_SAVING_NOTICE);
    await vi.waitFor(() => expect(ignore).toHaveBeenCalledOnce());
    finish();
    await vi.waitFor(() => expect(queue.idle()).toBe(true));
  });

  it("runs no record action while the registration is stale, and says so", () => {
    const ignore = vi.fn();
    const accept = vi.fn();
    const run = vi.fn();
    const goNext = vi.fn();
    const d = deps({
      stale: true,
      goNext,
      record: Symbol("previous"),
      actions: { ignore, accept, primary: { label: "Discard", run } },
    });

    for (const key of ["x", "a", "Enter"]) {
      expect(handleWorkspaceKey(keyEvent(key), d)).toBe(true);
    }

    for (const fn of [ignore, accept, run, goNext]) {
      expect(fn).not.toHaveBeenCalled();
    }
    expect(notice).toHaveBeenCalledTimes(3);
    expect(notice).toHaveBeenCalledWith(RECORD_LOADING_NOTICE);
  });

  it("treats Enter as Next on the list, where no record registers", () => {
    const d = deps();
    expect(handleWorkspaceKey(keyEvent("Enter"), d)).toBe(true);
    expect(d.goNext).toHaveBeenCalledOnce();
    expect(notice).not.toHaveBeenCalled();
  });

  it("treats Enter as Next on a ready record without a primary action", () => {
    const d = deps({ actions: {}, record: Symbol("ready") });
    expect(handleWorkspaceKey(keyEvent("Enter"), d)).toBe(true);
    expect(d.goNext).toHaveBeenCalledOnce();
  });

  it("keeps Enter from moving on while the next record has not registered", () => {
    const d = deps({ stale: true });
    expect(handleWorkspaceKey(keyEvent("Enter"), d)).toBe(true);
    expect(d.goNext).not.toHaveBeenCalled();
    expect(notice).toHaveBeenCalledExactlyOnceWith(RECORD_LOADING_NOTICE);
  });

  it("still moves and undoes while the registration is stale", () => {
    const d = deps({ stale: true, undo: vi.fn(() => true) });
    expect(handleWorkspaceKey(keyEvent("j"), d)).toBe(true);
    expect(handleWorkspaceKey(keyEvent("z"), d)).toBe(true);
    expect(d.goNext).toHaveBeenCalledOnce();
    expect(d.undo).toHaveBeenCalledOnce();
    expect(notice).not.toHaveBeenCalled();
  });

  it("reports unhandled keys when the record has no matching action", () => {
    expect(handleWorkspaceKey(keyEvent("a"), deps())).toBe(false);
  });

  it("undoes the latest step with Z and leaves Z unhandled when nothing is on the stack", () => {
    const undo = vi.fn(() => true);
    expect(handleWorkspaceKey(keyEvent("z"), deps({ undo }))).toBe(true);
    expect(undo).toHaveBeenCalledOnce();
    expect(handleWorkspaceKey(keyEvent("z"), deps())).toBe(false);
  });
});

describe("useWorkspaceKeyboard", () => {
  it("binds keys on the window and prevents their default", () => {
    renderHook(() => useWorkspaceKeyboard(navigation), { wrapper });
    const event = new KeyboardEvent("keydown", { key: "j", cancelable: true });
    globalThis.dispatchEvent(event);
    expect(navigation.goNext).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it("reads the registered record actions at key time and queues Z behind their write", async () => {
    const undo = vi.fn(() => Promise.resolve());
    let land = () => {};
    const accept = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          land = () => {
            useWorkspaceSelectionStore.getState().pushUndo({
              label: "Used Rarity from Provider A on Vi",
              undoneLabel: "Undone: Rarity restored on Vi",
              invalidates: [],
              undo,
            });
            resolve();
          };
        }),
    );
    renderHook(() => useWorkspaceKeyboard(), { wrapper });
    useWorkspaceActionsStore.getState().register({ accept }, Symbol("record"));
    const pressZ = new KeyboardEvent("keydown", { key: "z", cancelable: true });
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    await vi.waitFor(() => expect(accept).toHaveBeenCalledOnce());
    globalThis.dispatchEvent(pressZ);
    expect(pressZ.defaultPrevented).toBe(true);
    land();
    await vi.waitFor(() => expect(undo).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([]));
    expect(notice).not.toHaveBeenCalled();
  });

  it("undoes a write a button started once it lands when Z is pressed during it", async () => {
    const undo = vi.fn(() => Promise.resolve());
    let land = () => {};
    renderHook(() => useWorkspaceKeyboard(), { wrapper });
    useWorkspaceActionsStore.getState().register({}, Symbol("record"));
    const older = {
      label: "Ignored Ekko",
      undoneLabel: "Undone: Ekko is back in the queue",
      invalidates: [],
      undo: vi.fn(() => Promise.resolve()),
    };
    useWorkspaceSelectionStore.getState().pushUndo(older);
    void queueWorkspaceWrite(
      new QueryClient(),
      () =>
        new Promise<void>((resolve) => {
          land = () => {
            useWorkspaceSelectionStore.getState().pushUndo({
              label: "Used Rarity from Provider A on Vi",
              undoneLabel: "Undone: Rarity restored on Vi",
              invalidates: [],
              undo,
            });
            resolve();
          };
        }),
    );

    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "z" }));
    await Promise.resolve();
    expect(older.undo).not.toHaveBeenCalled();
    land();

    await vi.waitFor(() => expect(undo).toHaveBeenCalledOnce());
    expect(older.undo).not.toHaveBeenCalled();
  });

  it("starts a key action pressed after Z only once the undo finished", async () => {
    let finishUndo = () => {};
    const order: string[] = [];
    useWorkspaceSelectionStore.getState().pushUndo({
      label: "Ignored Ekko",
      undoneLabel: "Undone: Ekko is back in the queue",
      invalidates: [],
      undo: () =>
        new Promise<void>((resolve) => {
          order.push("undo start");
          finishUndo = () => {
            order.push("undo end");
            resolve();
          };
        }),
    });
    const ignore = vi.fn(() => {
      order.push("ignore");
    });
    renderHook(() => useWorkspaceKeyboard(), { wrapper });
    useWorkspaceActionsStore.getState().register({ ignore }, Symbol("record"));

    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "z" }));
    await vi.waitFor(() => expect(order).toEqual(["undo start"]));
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
    await Promise.resolve();
    expect(ignore).not.toHaveBeenCalled();
    finishUndo();

    await vi.waitFor(() => expect(ignore).toHaveBeenCalledOnce());
    expect(order).toEqual(["undo start", "undo end", "ignore"]);
  });

  it("keeps X away from the record being left and runs it on the next record once that registers", async () => {
    const ignorePrevious = vi.fn();
    const ignoreNext = vi.fn();
    renderHook(() => useWorkspaceKeyboard(), { wrapper });
    const previous = Symbol("previous");
    useWorkspaceActionsStore.getState().register({ ignore: ignorePrevious }, previous);
    useWorkspaceActionsStore.getState().leave(false);

    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
    useWorkspaceActionsStore.getState().register({ ignore: ignorePrevious }, previous);
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
    useWorkspaceActionsStore.getState().unregister(previous);
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));

    expect(notice).toHaveBeenCalledTimes(3);
    expect(notice).toHaveBeenCalledWith(RECORD_LOADING_NOTICE);

    useWorkspaceActionsStore.getState().register({ ignore: ignoreNext }, Symbol("next"));
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
    await vi.waitFor(() => expect(ignoreNext).toHaveBeenCalledOnce());
    expect(ignorePrevious).not.toHaveBeenCalled();
  });

  it("says the record is still loading for X, A and Enter while it registers as loading", () => {
    renderHook(() => useWorkspaceKeyboard(navigation), { wrapper });
    const run = vi.fn();
    useWorkspaceActionsStore
      .getState()
      .register({ loading: true, primary: { label: "Next", run } }, Symbol("loading"));

    for (const key of ["x", "a", "Enter"]) {
      const event = new KeyboardEvent("keydown", { key, cancelable: true });
      globalThis.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }

    expect(notice).toHaveBeenCalledTimes(3);
    expect(notice).toHaveBeenCalledWith(RECORD_LOADING_NOTICE);
    expect(run).not.toHaveBeenCalled();
    expect(navigation.goNext).not.toHaveBeenCalled();
  });

  it("does not skip a record when Enter follows J before the next record registers", () => {
    renderHook(() => useWorkspaceKeyboard(navigation), { wrapper });
    const previous = Symbol("previous");
    useWorkspaceActionsStore.getState().register({}, previous);
    useWorkspaceActionsStore.getState().leave(false);
    useWorkspaceActionsStore.getState().unregister(previous);

    const event = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
    globalThis.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(navigation.goNext).not.toHaveBeenCalled();
    expect(notice).toHaveBeenCalledExactlyOnceWith(RECORD_LOADING_NOTICE);
  });

  it("keeps Enter on a record opened from the list until that record registers", () => {
    renderHook(() => useWorkspaceKeyboard(navigation), { wrapper });

    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(navigation.goNext).not.toHaveBeenCalled();
    expect(notice).toHaveBeenCalledExactlyOnceWith(RECORD_LOADING_NOTICE);

    useWorkspaceActionsStore.getState().register({}, Symbol("record"));
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(navigation.goNext).toHaveBeenCalledOnce();
  });

  it("ignores keys while a dialog is in the document", () => {
    renderHook(() => useWorkspaceKeyboard(navigation), { wrapper });
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }));
    expect(navigation.goNext).not.toHaveBeenCalled();
  });

  it("keeps the keys while a closed select popup stays mounted", () => {
    renderHook(() => useWorkspaceKeyboard(navigation), { wrapper });
    const popup = document.createElement("div");
    popup.dataset.closed = "";
    const list = document.createElement("div");
    list.setAttribute("role", "listbox");
    popup.append(list);
    document.body.append(popup);
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }));
    expect(navigation.goNext).toHaveBeenCalledOnce();
  });

  it("stops listening on unmount", () => {
    const { unmount } = renderHook(() => useWorkspaceKeyboard(navigation), { wrapper });
    unmount();
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }));
    expect(navigation.goNext).not.toHaveBeenCalled();
  });

  it("binds only A, X and Z without navigation", async () => {
    const ignore = vi.fn();
    renderHook(() => useWorkspaceKeyboard(), { wrapper });
    useWorkspaceActionsStore.getState().register({ ignore }, Symbol("record"));

    for (const key of ["j", "k", "Enter", "s", "1"]) {
      const event = new KeyboardEvent("keydown", { key, cancelable: true });
      globalThis.dispatchEvent(event);
      expect(event.defaultPrevented, key).toBe(false);
    }
    const pressX = new KeyboardEvent("keydown", { key: "x", cancelable: true });
    globalThis.dispatchEvent(pressX);

    expect(pressX.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(ignore).toHaveBeenCalledOnce());
    expect(notice).not.toHaveBeenCalled();
  });
});
