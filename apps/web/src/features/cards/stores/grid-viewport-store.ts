import { create } from "zustand";

// A viewport fact, not a preference: useResponsiveColumns derives it on every
// resize and it means nothing on the next visit. Kept out of the persisted
// display store so a resize doesn't wake every preference subscriber.
interface GridViewportState {
  autoColumns: number;
  setAutoColumns: (autoColumns: number) => void;
}

export const useGridViewportStore = create<GridViewportState>()((set) => ({
  autoColumns: 5,
  setAutoColumns: (autoColumns) =>
    set((state) => (state.autoColumns === autoColumns ? state : { autoColumns })),
}));
