import { create } from "zustand";

/** Rows picked on the current Mirror page; a selection never outlives its view. */
interface MetaMirrorSelectionState {
  /** The view the keys belong to, so a page, filter or source change empties it. */
  scope: string;
  keys: Set<string>;
  toggle: (scope: string, key: string) => void;
  setAll: (scope: string, keys: readonly string[]) => void;
  clear: () => void;
}

export function isMirrorRowSelected(
  state: MetaMirrorSelectionState,
  scope: string,
  key: string,
): boolean {
  return state.scope === scope && state.keys.has(key);
}

export function selectedMirrorKeys(state: MetaMirrorSelectionState, scope: string): string[] {
  return state.scope === scope ? [...state.keys] : [];
}

export const useMetaMirrorSelectionStore = create<MetaMirrorSelectionState>()((set) => ({
  scope: "",
  keys: new Set<string>(),

  toggle: (scope, key) =>
    set((state) => {
      const next = new Set(state.scope === scope ? state.keys : []);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return { scope, keys: next };
    }),

  setAll: (scope, keys) => set({ scope, keys: new Set(keys) }),

  clear: () => set({ keys: new Set<string>() }),
}));
