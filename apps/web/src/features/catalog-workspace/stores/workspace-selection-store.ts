import { create } from "zustand";

import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";

const UNDO_LIMIT = 20;

interface WorkspaceSelectionState {
  undoStack: WorkspaceUndoEntry[];
  undoing: boolean;
  undoQueue: WorkspaceUndoEntry[];
  pushUndo: (entry: WorkspaceUndoEntry) => void;
  removeUndo: (entry: WorkspaceUndoEntry) => boolean;
  setUndoing: (undoing: boolean) => void;
  setUndoQueue: (queue: WorkspaceUndoEntry[]) => void;
  clearUndo: () => void;
}

export const useWorkspaceSelectionStore = create<WorkspaceSelectionState>()((set, get) => ({
  undoStack: [],
  undoing: false,
  undoQueue: [],

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

  setUndoQueue: (undoQueue) => set({ undoQueue }),

  clearUndo: () => set({ undoStack: [] }),
}));
