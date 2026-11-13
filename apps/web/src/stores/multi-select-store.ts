import { create } from "zustand";

interface MultiSelectState {
  selected: Set<string>;
  selectMode: boolean;
  toggleSelect: (id: string) => void;
  toggleStack: (ids: string[]) => void;
  toggleSelectAll: (allIds: string[]) => void;
  enterSelectAll: (allIds: string[]) => void;
  addToSelection: (ids: string[]) => void;
  clearSelection: () => void;
  setSelectMode: (on: boolean) => void;
  // Used on scope change: an item selected in the previous scope isn't on
  // screen any more, so the float bar would otherwise act on rows nobody can see.
  resetSelection: () => void;
}

/** One instance per surface. */
export function createMultiSelectStore() {
  return create<MultiSelectState>()((set) => ({
    selected: new Set(),
    selectMode: false,
    toggleSelect: (id) => {
      set((state) => {
        const next = new Set(state.selected);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return { selected: next };
      });
    },
    toggleStack: (ids) => {
      if (ids.length === 0) {
        return;
      }
      set((state) => {
        const next = new Set(state.selected);
        const allSelected = ids.every((id) => next.has(id));
        for (const id of ids) {
          if (allSelected) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }
        return { selected: next };
      });
    },
    toggleSelectAll: (allIds) => {
      set((state) => {
        if (state.selected.size === allIds.length) {
          return { selected: new Set() };
        }
        return { selected: new Set(allIds) };
      });
    },
    enterSelectAll: (allIds) => set({ selectMode: true, selected: new Set(allIds) }),
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
}
