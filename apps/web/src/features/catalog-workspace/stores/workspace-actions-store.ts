import { create } from "zustand";

export interface WorkspaceRecordActions {
  primary?: { label: string; disabled?: boolean; run: () => Promise<void> | void };
  accept?: () => Promise<void> | void;
  ignore?: () => Promise<void> | void;
  useSuggestion?: (n: number) => void;
}

interface WorkspaceActionsState {
  actions: WorkspaceRecordActions | null;
  owner: symbol | null;
  register: (actions: WorkspaceRecordActions, owner: symbol) => void;
  unregister: (owner: symbol) => void;
}

export const useWorkspaceActionsStore = create<WorkspaceActionsState>()((set, get) => ({
  actions: null,
  owner: null,

  register: (actions, owner) => set({ actions, owner }),

  unregister: (owner) => {
    if (get().owner === owner) {
      set({ actions: null, owner: null });
    }
  },
}));
