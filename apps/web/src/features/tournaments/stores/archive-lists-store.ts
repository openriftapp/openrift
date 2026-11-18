import { create } from "zustand";

type Picks = Readonly<Record<string, string | null>>;
type Forced = Readonly<Record<string, boolean>>;

interface ArchiveListsState {
  tournamentId: string | null;
  picks: Picks;
  forced: Forced;
  pick: (tournamentId: string, participantId: string, identity: string | null) => void;
  setForced: (tournamentId: string, participantId: string, forced: boolean) => void;
}

const NO_PICKS: Picks = {};
const NO_FORCED: Forced = {};

/** The organizer's picks for this tournament; another tournament's picks read as none. */
export function archivePicks(state: ArchiveListsState, tournamentId: string): Picks {
  return state.tournamentId === tournamentId ? state.picks : NO_PICKS;
}

/** The forced lists for this tournament; another tournament's read as none. */
export function archiveForced(state: ArchiveListsState, tournamentId: string): Forced {
  return state.tournamentId === tournamentId ? state.forced : NO_FORCED;
}

export const useArchiveListsStore = create<ArchiveListsState>()((set) => ({
  tournamentId: null,
  picks: NO_PICKS,
  forced: NO_FORCED,
  pick: (tournamentId, participantId, identity) =>
    set((state) => ({
      tournamentId,
      picks: { ...archivePicks(state, tournamentId), [participantId]: identity },
      forced: archiveForced(state, tournamentId),
    })),
  setForced: (tournamentId, participantId, forced) =>
    set((state) => ({
      tournamentId,
      picks: archivePicks(state, tournamentId),
      forced: { ...archiveForced(state, tournamentId), [participantId]: forced },
    })),
}));
