import type { StoreApi } from "zustand";
import { createStore } from "zustand/vanilla";

interface RowSelectionState {
  scope: string;
  keys: ReadonlySet<string>;
  toggle: (scope: string, key: string, checked: boolean) => void;
  setAll: (scope: string, keys: readonly string[]) => void;
  clear: () => void;
}

function createRowSelectionStore() {
  return createStore<RowSelectionState>()((set) => ({
    scope: "",
    keys: new Set<string>(),

    toggle: (scope, key, checked) =>
      set((state) => {
        const next = new Set(state.scope === scope ? state.keys : []);
        if (checked) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return { scope, keys: next };
      }),

    setAll: (scope, keys) => set({ scope, keys: new Set(keys) }),

    clear: () => set({ keys: new Set<string>() }),
  }));
}

export type RowSelectionStore = StoreApi<RowSelectionState>;

export function isRowSelected(state: RowSelectionState, scope: string, key: string): boolean {
  return state.scope === scope && state.keys.has(key);
}

export function selectedRowKeys(state: RowSelectionState, scope: string): string[] {
  return state.scope === scope ? [...state.keys] : [];
}

export const mirrorSelectionStore = createRowSelectionStore();
export const workspaceRowSelectionStore = createRowSelectionStore();
export const deskSelectionStore = createRowSelectionStore();
