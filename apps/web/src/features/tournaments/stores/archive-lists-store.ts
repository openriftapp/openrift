import { create } from "zustand";

interface ArchiveListsState {
  tournamentId: string | null;
  picks: Record<string, string | null>;
  forced: Record<string, boolean>;
  open: (tournamentId: string) => void;
  pick: (participantId: string, identity: string | null) => void;
  setForced: (participantId: string, forced: boolean) => void;
}

export const useArchiveListsStore = create<ArchiveListsState>()((set, get) => ({
  tournamentId: null,
  picks: {},
  forced: {},
  open: (tournamentId) => {
    if (get().tournamentId !== tournamentId) {
      set({ tournamentId, picks: {}, forced: {} });
    }
  },
  pick: (participantId, identity) =>
    set((state) => ({ picks: { ...state.picks, [participantId]: identity } })),
  setForced: (participantId, forced) =>
    set((state) => ({ forced: { ...state.forced, [participantId]: forced } })),
}));
