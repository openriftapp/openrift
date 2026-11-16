import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { FieldPicker } from "@/lib/persist-merge";
import { mergeFields, pickStringArray } from "@/lib/persist-merge";

export type GroupNudgeKind = "contacts" | "lists";

export function groupNudgeKey(slug: string, kind: GroupNudgeKind): string {
  return `${slug}:${kind}`;
}

const INTRO_KEYS = [
  "tier-list",
  "stage",
  "list",
  "deck-builder",
  "collection",
  "deck-builder-beta",
] as const;

type IntroKey = (typeof INTRO_KEYS)[number];

const pickIntros: FieldPicker<IntroKey[]> = (value) =>
  Array.isArray(value)
    ? value.filter((entry): entry is IntroKey => INTRO_KEYS.includes(entry as IntroKey))
    : undefined;

interface OnboardingState {
  dismissedMissingImagePrintings: string[];
  dismissMissingImagesNudge: (printingIds: string[]) => void;
  dismissedIntros: IntroKey[];
  dismissIntro: (key: IntroKey) => void;
  dismissedGroupNudges: string[];
  dismissGroupNudge: (slug: string, kind: GroupNudgeKind) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      dismissedMissingImagePrintings: [],
      dismissMissingImagesNudge: (printingIds) =>
        set({ dismissedMissingImagePrintings: [...printingIds] }),
      dismissedIntros: [],
      dismissIntro: (key) =>
        set((state) =>
          state.dismissedIntros.includes(key)
            ? state
            : { dismissedIntros: [...state.dismissedIntros, key] },
        ),
      dismissedGroupNudges: [],
      dismissGroupNudge: (slug, kind) =>
        set((state) => {
          const key = groupNudgeKey(slug, kind);
          if (state.dismissedGroupNudges.includes(key)) {
            return state;
          }
          return { dismissedGroupNudges: [...state.dismissedGroupNudges, key] };
        }),
    }),
    {
      name: "openrift-onboarding",
      partialize: (state) => ({
        dismissedMissingImagePrintings: state.dismissedMissingImagePrintings,
        dismissedIntros: state.dismissedIntros,
        dismissedGroupNudges: state.dismissedGroupNudges,
      }),
      merge: mergeFields<OnboardingState>({
        dismissedMissingImagePrintings: pickStringArray,
        dismissedIntros: pickIntros,
        dismissedGroupNudges: pickStringArray,
      }),
    },
  ),
);
