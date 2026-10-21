import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceActionsStore } from "@/features/catalog-workspace/stores/workspace-actions-store";
import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { createStoreResetter } from "@/test/store-helpers";

const navigation = {
  goNext: vi.fn(),
  goPrev: vi.fn(),
  skipToEnd: vi.fn(),
  position: null,
};

vi.mock("@/features/catalog-workspace/hooks/use-queue-navigation", () => ({
  useQueueNavigation: () => navigation,
}));

const { handleWorkspaceKey, useWorkspaceKeyboard, workspaceKeyAction } =
  await import("./use-workspace-keyboard");

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
    skipToEnd: vi.fn(),
    actions: null,
    popUndo: vi.fn(() => null),
    overlayOpen: () => false,
    busy: { current: false },
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
  resetActions();
  resetSelection();
  document.body.innerHTML = "";
});

describe("workspaceKeyAction", () => {
  it("maps the bound keys, upper or lower case", () => {
    expect(workspaceKeyAction(keyEvent("j"))).toEqual({ action: "next" });
    expect(workspaceKeyAction(keyEvent("K"))).toEqual({ action: "previous" });
    expect(workspaceKeyAction(keyEvent("Enter"))).toEqual({ action: "settle-and-next" });
    expect(workspaceKeyAction(keyEvent("3"))).toEqual({ action: "use-suggestion", digit: 3 });
  });

  it("ignores modified keys and unbound keys", () => {
    expect(workspaceKeyAction(keyEvent("j", { metaKey: true }))).toBeNull();
    expect(workspaceKeyAction(keyEvent("k", { ctrlKey: true }))).toBeNull();
    expect(workspaceKeyAction(keyEvent("q"))).toBeNull();
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
  it("moves with J and K and skips with S", () => {
    const d = deps();
    expect(handleWorkspaceKey(keyEvent("j"), d)).toBe(true);
    expect(handleWorkspaceKey(keyEvent("k"), d)).toBe(true);
    expect(handleWorkspaceKey(keyEvent("s"), d)).toBe(true);
    expect(d.goNext).toHaveBeenCalledOnce();
    expect(d.goPrev).toHaveBeenCalledOnce();
    expect(d.skipToEnd).toHaveBeenCalledOnce();
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

  it("calls accept, ignore and the numbered suggestion", async () => {
    const accept = vi.fn();
    const ignore = vi.fn();
    const useSuggestion = vi.fn();
    const d = deps({ actions: { accept, ignore, useSuggestion } });
    handleWorkspaceKey(keyEvent("a"), d);
    await vi.waitFor(() => expect(d.busy.current).toBe(false));
    handleWorkspaceKey(keyEvent("x"), d);
    handleWorkspaceKey(keyEvent("2"), d);
    expect(accept).toHaveBeenCalledOnce();
    expect(ignore).toHaveBeenCalledOnce();
    expect(useSuggestion).toHaveBeenCalledWith(2);
  });

  it("runs a pressed action once while its previous run is pending", async () => {
    let finish = () => {};
    const run = vi.fn(
      () =>
        // oxlint-disable-next-line promise/avoid-new -- held open so the second press lands mid-run
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const accept = vi.fn();
    const d = deps({ actions: { primary: { label: "Discard", run }, accept } });

    expect(handleWorkspaceKey(keyEvent("Enter"), d)).toBe(true);
    expect(handleWorkspaceKey(keyEvent("Enter"), d)).toBe(true);
    expect(handleWorkspaceKey(keyEvent("a"), d)).toBe(true);
    expect(run).toHaveBeenCalledOnce();
    expect(accept).not.toHaveBeenCalled();

    finish();
    await vi.waitFor(() => expect(d.busy.current).toBe(false));
    handleWorkspaceKey(keyEvent("Enter"), d);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("reports unhandled keys when the record has no matching action", () => {
    expect(handleWorkspaceKey(keyEvent("a"), deps())).toBe(false);
    expect(handleWorkspaceKey(keyEvent("1"), deps())).toBe(false);
  });

  it("undoes the latest step with Z", () => {
    const undo = vi.fn(() => Promise.resolve());
    expect(handleWorkspaceKey(keyEvent("z"), deps({ popUndo: () => ({ undo }) }))).toBe(true);
    expect(undo).toHaveBeenCalledOnce();
    expect(handleWorkspaceKey(keyEvent("z"), deps())).toBe(false);
  });
});

describe("useWorkspaceKeyboard", () => {
  it("binds keys on the window and prevents their default", () => {
    renderHook(() => useWorkspaceKeyboard("card"));
    const event = new KeyboardEvent("keydown", { key: "j", cancelable: true });
    globalThis.dispatchEvent(event);
    expect(navigation.goNext).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it("reads the registered record actions and the undo stack at key time", () => {
    const accept = vi.fn();
    const undo = vi.fn(() => Promise.resolve());
    renderHook(() => useWorkspaceKeyboard("printing"));
    useWorkspaceActionsStore.getState().register({ accept }, Symbol("record"));
    useWorkspaceSelectionStore.getState().pushUndo({ label: "Used rarity", undo });
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "z" }));
    expect(accept).toHaveBeenCalledOnce();
    expect(undo).toHaveBeenCalledOnce();
    expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([]);
  });

  it("ignores keys while a dialog is in the document", () => {
    renderHook(() => useWorkspaceKeyboard("face"));
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }));
    expect(navigation.goNext).not.toHaveBeenCalled();
  });

  it("stops listening on unmount", () => {
    const { unmount } = renderHook(() => useWorkspaceKeyboard("card"));
    unmount();
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }));
    expect(navigation.goNext).not.toHaveBeenCalled();
  });
});
