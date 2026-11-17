import { create } from "zustand";

export interface WorkspaceRecordActions {
  primary?: { label: string; disabled?: boolean; run: () => Promise<void> | void };
  accept?: () => Promise<void> | void;
  ignore?: () => Promise<void> | void;
  useSuggestion?: (n: number) => Promise<void> | void;
  loading?: boolean;
}

interface Leaving {
  from: symbol | null;
  toList: boolean;
}

interface WorkspaceActionsState {
  actions: WorkspaceRecordActions | null;
  owner: symbol | null;
  /** Set when queue navigation starts, cleared when another record registers. */
  leaving: Leaving | null;
  register: (actions: WorkspaceRecordActions, owner: symbol) => void;
  unregister: (owner: symbol) => void;
  leave: (toList: boolean) => void;
}

export const useWorkspaceActionsStore = create<WorkspaceActionsState>()((set, get) => ({
  actions: null,
  owner: null,
  leaving: null,

  register: (actions, owner) =>
    set((state) => ({ actions, owner, leaving: owner === state.owner ? state.leaving : null })),

  unregister: (owner) => {
    if (get().owner === owner) {
      set({ actions: null, owner: null });
    }
  },

  leave: (toList) => set((state) => ({ leaving: { from: state.owner, toList } })),
}));

/**
 * True while the registered actions belong to the record being left, no record has registered
 * yet, or the registered record is still loading.
 */
export function registrationIsStale(
  state: Pick<WorkspaceActionsState, "actions" | "owner" | "leaving">,
) {
  const { actions, owner, leaving } = state;
  if (actions?.loading === true) {
    return true;
  }
  if (leaving === null) {
    return false;
  }
  return owner === null ? !leaving.toList : owner === leaving.from;
}
