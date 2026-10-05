import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  DeckListGroupBy,
  DeckListSortField,
  SortDir,
} from "@/features/decks/lib/deck-list-utils";
import { mergeFields, pickEnum } from "@/lib/persist-merge";
import { useLocalViewPrefsStore } from "@/stores/view-prefs-store";

type DeckListDensity = "grid" | "list";

const DENSITY_OPTIONS: readonly DeckListDensity[] = ["grid", "list"];

interface DeckListPrefsState {
  density: DeckListDensity;
  setDensity: (value: DeckListDensity) => void;
}

const DEFAULTS = {
  density: "grid" as DeckListDensity,
};

export const useDeckListPrefsStore = create<DeckListPrefsState>()(
  persist(
    (set) => ({
      density: DEFAULTS.density,
      setDensity: (value) => set({ density: value }),
    }),
    {
      name: "openrift-deck-list-prefs",
      partialize: (state) => ({ density: state.density }),
      // Filter keys from the pre-URL blob are ignored, so a stale bundle never discards a newer preference.
      merge: mergeFields<DeckListPrefsState>({ density: pickEnum(DENSITY_OPTIONS) }),
    },
  ),
);

/**
 * The values live in the shared per-surface view-prefs store; this hook is
 * just the typed window onto its "decks" entry.
 */
export function useDeckListViewPrefs() {
  const sortField = useLocalViewPrefsStore((state) => state.decks.sort) as DeckListSortField;
  const sortDir = useLocalViewPrefsStore((state) => state.decks.sortDir);
  const groupBy = useLocalViewPrefsStore((state) => state.decks.groupBy) as DeckListGroupBy;
  const groupDir = useLocalViewPrefsStore((state) => state.decks.groupDir);
  const setSort = useLocalViewPrefsStore((state) => state.setSort);
  const setSortDirection = useLocalViewPrefsStore((state) => state.setSortDir);
  const setGroup = useLocalViewPrefsStore((state) => state.setGroupBy);
  const setGroupDirection = useLocalViewPrefsStore((state) => state.setGroupDir);
  return {
    sortField,
    sortDir,
    groupBy,
    groupDir,
    setSortField: (value: DeckListSortField) => setSort("decks", value),
    setSortDir: (value: SortDir) => setSortDirection("decks", value),
    setGroupBy: (value: DeckListGroupBy) => setGroup("decks", value),
    setGroupDir: (value: SortDir) => setGroupDirection("decks", value),
  };
}
