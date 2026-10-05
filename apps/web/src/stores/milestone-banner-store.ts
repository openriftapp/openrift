import { create } from "zustand";
import { persist } from "zustand/middleware";

import { mergeFields, pickString } from "@/lib/persist-merge";

interface MilestoneBannerState {
  dismissedDate: string | null;
  dismiss: (date: string) => void;
}

export const useMilestoneBannerStore = create<MilestoneBannerState>()(
  persist(
    (set) => ({
      dismissedDate: null,
      dismiss: (date) => set({ dismissedDate: date }),
    }),
    {
      name: "openrift-milestone-banner",
      partialize: (state) => ({ dismissedDate: state.dismissedDate }),
      merge: mergeFields<MilestoneBannerState>({ dismissedDate: pickString }),
    },
  ),
);
