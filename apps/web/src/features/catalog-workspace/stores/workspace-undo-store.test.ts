import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { useWorkspaceUndoStore } from "./workspace-undo-store";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useWorkspaceUndoStore);
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

describe("useWorkspaceUndoStore", () => {
  it("starts with an empty undo stack and no undo running", () => {
    const state = useWorkspaceUndoStore.getState();
    expect(state.undoStack).toEqual([]);
    expect(state.undoing).toBe(false);
  });

  describe("undo stack", () => {
    it("keeps entries newest last and never runs their undo itself", () => {
      const first = entry("Used rarity");
      const second = entry("Discarded Provider B");
      useWorkspaceUndoStore.getState().pushUndo(first);
      useWorkspaceUndoStore.getState().pushUndo(second);

      expect(useWorkspaceUndoStore.getState().undoStack).toEqual([first, second]);
      expect(first.undo).not.toHaveBeenCalled();
      expect(second.undo).not.toHaveBeenCalled();
    });

    it("tracks whether an undo is running", () => {
      useWorkspaceUndoStore.getState().setUndoing(true);
      expect(useWorkspaceUndoStore.getState().undoing).toBe(true);
      useWorkspaceUndoStore.getState().setUndoing(false);
      expect(useWorkspaceUndoStore.getState().undoing).toBe(false);
    });

    it("removes one entry by identity and leaves the rest", () => {
      const first = entry("Used rarity");
      const second = entry("Discarded Provider B");
      useWorkspaceUndoStore.getState().pushUndo(first);
      useWorkspaceUndoStore.getState().pushUndo(second);

      expect(useWorkspaceUndoStore.getState().removeUndo(first)).toBe(true);
      expect(useWorkspaceUndoStore.getState().undoStack).toEqual([second]);
      expect(useWorkspaceUndoStore.getState().removeUndo(first)).toBe(false);
    });

    it("keeps only the 20 most recent entries", () => {
      for (let index = 0; index < 25; index++) {
        useWorkspaceUndoStore.getState().pushUndo(entry(`Step ${index}`));
      }
      const stack = useWorkspaceUndoStore.getState().undoStack;
      expect(stack).toHaveLength(20);
      expect(stack.at(0)?.label).toBe("Step 5");
      expect(stack.at(-1)?.label).toBe("Step 24");
    });

    it("clears every entry", () => {
      useWorkspaceUndoStore.getState().pushUndo(entry("Used artist"));
      useWorkspaceUndoStore.getState().clearUndo();
      expect(useWorkspaceUndoStore.getState().undoStack).toEqual([]);
    });
  });
});
