import { create } from "zustand";
import { persist } from "zustand/middleware";

import { mergeFields, pickBoolean } from "@/lib/persist-merge";

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
      merge: mergeFields<LocaleBannerState>({ dismissed: pickBoolean }),
    },
  ),
);
