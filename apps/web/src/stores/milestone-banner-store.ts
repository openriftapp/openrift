import { create } from "zustand";
import { persist } from "zustand/middleware";

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
      merge: (persisted, current) => {
        const raw = persisted as { dismissedDate?: unknown } | undefined;
        const dismissedDate =
          typeof raw?.dismissedDate === "string" ? raw.dismissedDate : current.dismissedDate;
        return { ...current, dismissedDate };
      },
    },
  ),
);
