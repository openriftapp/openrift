import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { createStoreResetter } from "@/test/store-helpers";

const router = vi.hoisted(() => ({ latestLocation: { pathname: "/admin/workspace/faces" } }));

vi.mock("@tanstack/react-router", () => ({ useRouter: () => router }));

const { isWorkspacePath, useClearUndoOnLeave } = await import("./use-clear-undo-on-leave");

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useWorkspaceSelectionStore);
  useWorkspaceSelectionStore.getState().pushUndo({
    label: "Ignored Ekko",
    undoneLabel: "Undone: Ekko is back in the queue",
    invalidates: [],
    undo: () => Promise.resolve(),
  });
});

afterEach(() => {
  resetStore();
});

describe("isWorkspacePath", () => {
  it("matches the workspace and its pages only", () => {
    expect(isWorkspacePath("/admin/workspace")).toBe(true);
    expect(isWorkspacePath("/admin/workspace/cards/jinx")).toBe(true);
    expect(isWorkspacePath("/admin/workspaces")).toBe(false);
    expect(isWorkspacePath("/admin/cards")).toBe(false);
  });
});

describe("useClearUndoOnLeave", () => {
  it("keeps the stack when the next page is still in the workspace", () => {
    const { unmount } = renderHook(() => useClearUndoOnLeave());
    router.latestLocation = { pathname: "/admin/workspace/printings" };
    unmount();
    expect(useWorkspaceSelectionStore.getState().undoStack).toHaveLength(1);
  });

  it("clears the stack when the next page is outside the workspace", () => {
    const { unmount } = renderHook(() => useClearUndoOnLeave());
    router.latestLocation = { pathname: "/admin/sets" };
    unmount();
    expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([]);
  });
});
