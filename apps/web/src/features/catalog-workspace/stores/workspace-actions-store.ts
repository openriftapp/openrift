import type { WorkspaceOwner } from "@openrift/shared/contracts/admin/catalog-workspace";
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
  skipped: Partial<Record<WorkspaceOwner, string[]>>;
  register: (actions: WorkspaceRecordActions, owner: symbol) => void;
  unregister: (owner: symbol) => void;
  skip: (queue: WorkspaceOwner, key: string) => void;
  clearSkipped: (queue: WorkspaceOwner) => void;
}

export const useWorkspaceActionsStore = create<WorkspaceActionsState>()((set, get) => ({
  actions: null,
  owner: null,
  skipped: {},

  register: (actions, owner) => set({ actions, owner }),

  unregister: (owner) => {
    if (get().owner === owner) {
      set({ actions: null, owner: null });
    }
  },

  skip: (queue, key) =>
    set((state) => ({
      skipped: {
        ...state.skipped,
        [queue]: [...(state.skipped[queue] ?? []).filter((entry) => entry !== key), key],
      },
    })),

  clearSkipped: (queue) => set((state) => ({ skipped: { ...state.skipped, [queue]: [] } })),
}));
