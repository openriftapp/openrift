import { create } from "zustand";

interface AppliedStagePresetState {
  appliedIds: readonly string[];
  markApplied: (id: string) => void;
}

/**
 * The `?preset=` ids applied since the page loaded. The builder and the show both read it,
 * so moving between them carries the param without applying it again.
 */
export const useAppliedStagePresetStore = create<AppliedStagePresetState>()((set) => ({
  appliedIds: [],
  markApplied: (id) => {
    set((state) =>
      state.appliedIds.includes(id) ? state : { appliedIds: [...state.appliedIds, id] },
    );
  },
}));
