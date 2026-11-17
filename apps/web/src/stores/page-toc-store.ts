import { create } from "zustand";

interface PageTocState {
  activeId: string | null;
  heldId: string | null;
  setActiveId: (id: string | null) => void;
  selectActiveId: (id: string, hold: boolean) => void;
  releaseHold: (id?: string) => void;
}

export const usePageTocStore = create<PageTocState>()((set) => ({
  activeId: null,
  heldId: null,
  setActiveId: (id) => {
    set((state) => (state.heldId !== null || state.activeId === id ? state : { activeId: id }));
  },
  selectActiveId: (id, hold) => {
    set({ activeId: id, heldId: hold ? id : null });
  },
  releaseHold: (id) => {
    set((state) =>
      state.heldId === null || (id !== undefined && state.heldId !== id) ? state : { heldId: null },
    );
  },
}));
