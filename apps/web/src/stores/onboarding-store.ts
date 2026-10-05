import { create } from "zustand";
import { persist } from "zustand/middleware";

import { mergeFields, pickStringArray } from "@/lib/persist-merge";

export type GroupNudgeKind = "contacts" | "lists";

export function groupNudgeKey(slug: string, kind: GroupNudgeKind): string {
  return `${slug}:${kind}`;
}

const INTRO_KEYS = ["tier-list", "stage", "list", "deck-builder", "collection"] as const;

type IntroKey = (typeof INTRO_KEYS)[number];

const LEGACY_INTRO_FLAGS = {
  deckBuilderIntroDismissed: "deck-builder",
  collectionIntroDismissed: "collection",
} as const satisfies Record<string, IntroKey>;

function persistedIntros(persisted: unknown): IntroKey[] | undefined {
  if (typeof persisted !== "object" || persisted === null) {
    return;
  }
  const raw = persisted as Record<string, unknown>;
  const intros = Array.isArray(raw.dismissedIntros)
    ? raw.dismissedIntros.filter((entry): entry is IntroKey =>
        INTRO_KEYS.includes(entry as IntroKey),
      )
    : [];
  for (const [flag, key] of Object.entries(LEGACY_INTRO_FLAGS)) {
    if (raw[flag] === true && !intros.includes(key)) {
      intros.push(key);
    }
  }
  return Array.isArray(raw.dismissedIntros) || intros.length > 0 ? intros : undefined;
}

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
      merge: (persisted, current) => {
        const merged = mergeFields<OnboardingState>({
          dismissedMissingImagePrintings: pickStringArray,
          dismissedGroupNudges: pickStringArray,
        })(persisted, current);
        return {
          ...merged,
          dismissedIntros: persistedIntros(persisted) ?? current.dismissedIntros,
        };
      },
    },
  ),
);
