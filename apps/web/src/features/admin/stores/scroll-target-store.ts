import { create } from "zustand";

export interface ScrollRequest {
  key: string;
  block: ScrollLogicalPosition;
}

interface ScrollTargetState {
  request: ScrollRequest | null;
  /** The element registered under `key` scrolls itself into view once it is mounted. */
  scrollTo: (key: string, block: ScrollLogicalPosition) => void;
  done: (request: ScrollRequest) => void;
}

export const useScrollTargetStore = create<ScrollTargetState>()((set, get) => ({
  request: null,

  scrollTo: (key, block) => set({ request: { key, block } }),

  done: (request) => {
    if (get().request === request) {
      set({ request: null });
    }
  },
}));
