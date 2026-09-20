import { create } from "zustand";

interface GridSelectionState {
  selected: Set<string>;
  selectMode: boolean;
  toggleSelect: (copyId: string) => void;
  toggleStack: (copyIds: string[]) => void;
  toggleSelectAll: (allCopyIds: string[]) => void;
  addToSelection: (ids: string[]) => void;
  clearSelection: () => void;
  setSelectMode: (on: boolean) => void;
  // Used on scope change: a copy selected in the previous scope isn't in the
  // new grid, so the float bar would otherwise act on rows nobody can see.
  resetSelection: () => void;
}

export const useGridSelectionStore = create<GridSelectionState>()((set) => ({
  selected: new Set(),
  selectMode: false,
  toggleSelect: (copyId) => {
    set((state) => {
      const next = new Set(state.selected);
      if (next.has(copyId)) {
        next.delete(copyId);
      } else {
        next.add(copyId);
      }
      return { selected: next };
    });
  },
  toggleStack: (copyIds) => {
    if (copyIds.length === 0) {
      return;
    }
    set((state) => {
      const next = new Set(state.selected);
      const allSelected = copyIds.every((id) => next.has(id));
      for (const id of copyIds) {
        if (allSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return { selected: next };
    });
  },
  toggleSelectAll: (allCopyIds) => {
    set((state) => {
      if (state.selected.size === allCopyIds.length) {
        return { selected: new Set() };
      }
      return { selected: new Set(allCopyIds) };
    });
  },
  addToSelection: (ids) => {
    if (ids.length === 0) {
      return;
    }
    set((state) => {
      const next = new Set(state.selected);
      for (const id of ids) {
        next.add(id);
      }
      return { selected: next };
    });
  },
  clearSelection: () => set({ selected: new Set() }),
  setSelectMode: (on) => set({ selectMode: on }),
  resetSelection: () => set({ selected: new Set(), selectMode: false }),
}));
