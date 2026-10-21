import { create } from "zustand";

export interface WorkspaceUndoEntry {
  label: string;
  undo: () => Promise<void>;
}

const UNDO_LIMIT = 20;

interface WorkspaceSelectionState {
  listCollapsed: boolean;
  undoStack: WorkspaceUndoEntry[];
  setListCollapsed: (collapsed: boolean) => void;
  toggleListCollapsed: () => void;
  pushUndo: (entry: WorkspaceUndoEntry) => void;
  popUndo: () => WorkspaceUndoEntry | null;
  removeUndo: (entry: WorkspaceUndoEntry) => boolean;
  clearUndo: () => void;
}

export const useWorkspaceSelectionStore = create<WorkspaceSelectionState>()((set, get) => ({
  listCollapsed: false,
  undoStack: [],

  setListCollapsed: (collapsed) => set({ listCollapsed: collapsed }),

  toggleListCollapsed: () => set((state) => ({ listCollapsed: !state.listCollapsed })),

  pushUndo: (entry) =>
    set((state) => ({ undoStack: [...state.undoStack, entry].slice(-UNDO_LIMIT) })),

  popUndo: () => {
    const entry = get().undoStack.at(-1);
    if (entry === undefined) {
      return null;
    }
    set((state) => ({ undoStack: state.undoStack.slice(0, -1) }));
    return entry;
  },

  removeUndo: (entry) => {
    if (!get().undoStack.includes(entry)) {
      return false;
    }
    set((state) => ({ undoStack: state.undoStack.filter((candidate) => candidate !== entry) }));
    return true;
  },

  clearUndo: () => set({ undoStack: [] }),
}));
