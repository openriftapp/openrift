import { create } from "zustand";

// Published so data hooks can skip work invisible while the drawer is closed
// (faceted filter counts are the expensive case). Viewport facts, not
// preferences: reset on navigation, mean nothing on the next visit.
interface FilterDrawerState {
  /** Pathname the drawer is open on, null while closed. */
  openOn: string | null;
  openedOnce: boolean;
  setOpen: (open: boolean, pathname: string) => void;
}

export const useFilterDrawerStore = create<FilterDrawerState>()((set) => ({
  openOn: null,
  openedOnce: false,
  setOpen: (open, pathname) =>
    set((state) => ({ openOn: open ? pathname : null, openedOnce: state.openedOnce || open })),
}));
