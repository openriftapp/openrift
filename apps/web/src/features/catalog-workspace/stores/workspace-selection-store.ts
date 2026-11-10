import { create } from "zustand";

import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";

const UNDO_LIMIT = 20;

interface WorkspaceSelectionState {
  listCollapsed: boolean;
  undoStack: WorkspaceUndoEntry[];
  undoing: boolean;
  setListCollapsed: (collapsed: boolean) => void;
  toggleListCollapsed: () => void;
  pushUndo: (entry: WorkspaceUndoEntry) => void;
  removeUndo: (entry: WorkspaceUndoEntry) => boolean;
  setUndoing: (undoing: boolean) => void;
  clearUndo: () => void;
}

export const useWorkspaceSelectionStore = create<WorkspaceSelectionState>()((set, get) => ({
  listCollapsed: false,
  undoStack: [],
  undoing: false,

  setListCollapsed: (collapsed) => set({ listCollapsed: collapsed }),

  toggleListCollapsed: () => set((state) => ({ listCollapsed: !state.listCollapsed })),

  pushUndo: (entry) =>
    set((state) => ({ undoStack: [...state.undoStack, entry].slice(-UNDO_LIMIT) })),

  removeUndo: (entry) => {
    if (!get().undoStack.includes(entry)) {
      return false;
    }
    set((state) => ({ undoStack: state.undoStack.filter((candidate) => candidate !== entry) }));
    return true;
  },

  setUndoing: (undoing) => set({ undoing }),

  clearUndo: () => set({ undoStack: [] }),
}));
