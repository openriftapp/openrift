import { create } from "zustand";

import type { WriteLimit } from "@/features/catalog-workspace/lib/workspace-write-queue";

export interface WorkspaceRecordActions {
  primary?: {
    label: string;
    disabled?: boolean;
    run: (signal: AbortSignal) => Promise<void> | void;
  };
  accept?: (signal: AbortSignal) => Promise<void> | void;
  acceptLimit?: WriteLimit;
  ignore?: (signal: AbortSignal) => Promise<void> | void;
  dismissAll?: (signal: AbortSignal) => Promise<void> | void;
  loading?: boolean;
}

interface Leaving {
  from: symbol | null;
  toList: boolean;
}

interface WorkspaceActionsState {
  actions: WorkspaceRecordActions | null;
  owner: symbol | null;
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
    return owner === null;
  }
  return owner === null ? !leaving.toList : owner === leaving.from;
}
