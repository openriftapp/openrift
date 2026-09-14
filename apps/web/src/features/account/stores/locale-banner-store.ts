import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LocaleBannerState {
  dismissed: boolean;
  dismiss: () => void;
}

export const useLocaleBannerStore = create<LocaleBannerState>()(
  persist(
    (set) => ({
      dismissed: false,
      dismiss: () => set({ dismissed: true }),
    }),
    {
      name: "openrift-locale-banner",
      partialize: (state) => ({ dismissed: state.dismissed }),
      merge: (persisted, current) => {
        const raw = persisted as { dismissed?: unknown } | undefined;
        const dismissed = typeof raw?.dismissed === "boolean" ? raw.dismissed : current.dismissed;
        return { ...current, dismissed };
      },
    },
  ),
);
