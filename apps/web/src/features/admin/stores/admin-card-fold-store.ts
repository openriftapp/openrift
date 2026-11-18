import { create } from "zustand";

type AdminCardSectionId = "attention" | "cardFields" | "history" | "marketplace" | "printings";

interface AdminCardFoldState {
  collapsedBySlug: Record<string, Set<string>>;
  collapsedSections: Set<AdminCardSectionId>;
  togglePrinting: (cardSlug: string, printingId: string) => void;
  focusPrinting: (cardSlug: string, key: string, allKeys: readonly string[]) => void;
  setCollapsedForCard: (cardSlug: string, collapsed: Set<string>) => void;
  initCollapsedForCard: (cardSlug: string, collapsed: Set<string>) => void;
  toggleSection: (sectionId: AdminCardSectionId) => void;
}

/**
 * `undefined` (unseeded, falls back to the default fold) is distinct from an
 * explicitly empty set (everything open after "Expand all").
 */
export function getStoredCollapsedPrintings(
  state: AdminCardFoldState,
  cardSlug: string,
): ReadonlySet<string> | undefined {
  return state.collapsedBySlug[cardSlug];
}

export function getCollapsedSections(state: AdminCardFoldState): ReadonlySet<AdminCardSectionId> {
  return state.collapsedSections;
}

export const useAdminCardFoldStore = create<AdminCardFoldState>()((set) => ({
  collapsedBySlug: {},
  // History starts folded: opening it pages through the audit log.
  collapsedSections: new Set<AdminCardSectionId>(["history"]),

  togglePrinting: (cardSlug, printingId) =>
    set((state) => {
      const current = state.collapsedBySlug[cardSlug] ?? new Set<string>();
      const next = new Set(current);
      if (next.has(printingId)) {
        next.delete(printingId);
      } else {
        next.add(printingId);
      }
      return { collapsedBySlug: { ...state.collapsedBySlug, [cardSlug]: next } };
    }),

  focusPrinting: (cardSlug, key, allKeys) =>
    set((state) => ({
      collapsedBySlug: {
        ...state.collapsedBySlug,
        [cardSlug]: new Set(allKeys.filter((other) => other !== key)),
      },
    })),

  setCollapsedForCard: (cardSlug, collapsed) =>
    set((state) => ({
      collapsedBySlug: { ...state.collapsedBySlug, [cardSlug]: new Set(collapsed) },
    })),

  // Seeds the card's default folds on first visit. A no-op afterwards, so a
  // refetch never re-folds rows the admin just opened.
  initCollapsedForCard: (cardSlug, collapsed) =>
    set((state) => {
      if (state.collapsedBySlug[cardSlug]) {
        return state;
      }
      return { collapsedBySlug: { ...state.collapsedBySlug, [cardSlug]: new Set(collapsed) } };
    }),

  toggleSection: (sectionId) =>
    set((state) => {
      const next = new Set(state.collapsedSections);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return { collapsedSections: next };
    }),
}));
