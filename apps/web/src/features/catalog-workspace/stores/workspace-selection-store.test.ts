import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { useWorkspaceSelectionStore } from "./workspace-selection-store";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useWorkspaceSelectionStore);
});

afterEach(() => {
  resetStore();
});

function entry(label: string) {
  return {
    label,
    undoneLabel: `Undone: ${label}`,
    invalidates: [],
    undo: vi.fn(() => Promise.resolve()),
  };
}

describe("useWorkspaceSelectionStore", () => {
  it("starts expanded with an empty undo stack and no undo running", () => {
    const state = useWorkspaceSelectionStore.getState();
    expect(state.listCollapsed).toBe(false);
    expect(state.undoStack).toEqual([]);
    expect(state.undoing).toBe(false);
  });

  describe("list collapse", () => {
    it("sets the collapsed state", () => {
      useWorkspaceSelectionStore.getState().setListCollapsed(true);
      expect(useWorkspaceSelectionStore.getState().listCollapsed).toBe(true);
    });

    it("toggles the collapsed state", () => {
      useWorkspaceSelectionStore.getState().toggleListCollapsed();
      expect(useWorkspaceSelectionStore.getState().listCollapsed).toBe(true);
      useWorkspaceSelectionStore.getState().toggleListCollapsed();
      expect(useWorkspaceSelectionStore.getState().listCollapsed).toBe(false);
    });
  });

  describe("undo stack", () => {
    it("keeps entries newest last and never runs their undo itself", () => {
      const first = entry("Used rarity");
      const second = entry("Discarded Provider B");
      useWorkspaceSelectionStore.getState().pushUndo(first);
      useWorkspaceSelectionStore.getState().pushUndo(second);

      expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([first, second]);
      expect(first.undo).not.toHaveBeenCalled();
      expect(second.undo).not.toHaveBeenCalled();
    });

    it("tracks whether an undo is running", () => {
      useWorkspaceSelectionStore.getState().setUndoing(true);
      expect(useWorkspaceSelectionStore.getState().undoing).toBe(true);
      useWorkspaceSelectionStore.getState().setUndoing(false);
      expect(useWorkspaceSelectionStore.getState().undoing).toBe(false);
    });

    it("removes one entry by identity and leaves the rest", () => {
      const first = entry("Used rarity");
      const second = entry("Discarded Provider B");
      useWorkspaceSelectionStore.getState().pushUndo(first);
      useWorkspaceSelectionStore.getState().pushUndo(second);

      expect(useWorkspaceSelectionStore.getState().removeUndo(first)).toBe(true);
      expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([second]);
      expect(useWorkspaceSelectionStore.getState().removeUndo(first)).toBe(false);
    });

    it("keeps only the 20 most recent entries", () => {
      for (let index = 0; index < 25; index++) {
        useWorkspaceSelectionStore.getState().pushUndo(entry(`Step ${index}`));
      }
      const stack = useWorkspaceSelectionStore.getState().undoStack;
      expect(stack).toHaveLength(20);
      expect(stack.at(0)?.label).toBe("Step 5");
      expect(stack.at(-1)?.label).toBe("Step 24");
    });

    it("clears every entry", () => {
      useWorkspaceSelectionStore.getState().pushUndo(entry("Used artist"));
      useWorkspaceSelectionStore.getState().clearUndo();
      expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([]);
    });
  });
});
