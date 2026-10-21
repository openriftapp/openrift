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
  return { label, undo: vi.fn(() => Promise.resolve()) };
}

describe("useWorkspaceSelectionStore", () => {
  it("starts expanded with an empty undo stack", () => {
    const state = useWorkspaceSelectionStore.getState();
    expect(state.listCollapsed).toBe(false);
    expect(state.undoStack).toEqual([]);
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
    it("pops the most recent entry first", () => {
      const first = entry("Used rarity");
      const second = entry("Discarded Provider B");
      useWorkspaceSelectionStore.getState().pushUndo(first);
      useWorkspaceSelectionStore.getState().pushUndo(second);

      expect(useWorkspaceSelectionStore.getState().popUndo()).toBe(second);
      expect(useWorkspaceSelectionStore.getState().popUndo()).toBe(first);
    });

    it("returns null when there is nothing to undo", () => {
      expect(useWorkspaceSelectionStore.getState().popUndo()).toBeNull();
    });

    it("does not call the undo callback when popping", () => {
      const pushed = entry("Ignored");
      useWorkspaceSelectionStore.getState().pushUndo(pushed);
      useWorkspaceSelectionStore.getState().popUndo();
      expect(pushed.undo).not.toHaveBeenCalled();
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
