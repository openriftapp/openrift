import { isRecord } from "@openrift/shared/type-guards";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { mergeFields, pickBoolean } from "@/lib/persist-merge";

export interface AdminSettings {
  debugOverlay: boolean;
}

interface AdminSettingsState {
  settings: AdminSettings;
  update: (patch: Partial<AdminSettings>) => void;
}

export const useAdminSettingsStore = create<AdminSettingsState>()(
  persist(
    (set) => ({
      settings: { debugOverlay: false },
      update: (patch) =>
        set((state) => ({
          settings: { ...state.settings, ...patch },
        })),
    }),
    {
      name: "admin-settings",
      merge: mergeFields<AdminSettingsState>({
        settings: (value) => ({
          debugOverlay: (isRecord(value) ? pickBoolean(value.debugOverlay) : undefined) ?? false,
        }),
      }),
    },
  ),
);
