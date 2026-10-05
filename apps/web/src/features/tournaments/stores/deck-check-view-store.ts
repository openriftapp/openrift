import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { DeckCheckSort } from "@/features/tournaments/lib/deck-check-sort";
import { mergeFields, pickBoolean, pickEnum } from "@/lib/persist-merge";

export type DeckCheckDisplayMode = "grid" | "list";

interface DeckCheckViewState {
  wide: boolean;
  setWide: (wide: boolean) => void;
  displayMode: DeckCheckDisplayMode;
  setDisplayMode: (displayMode: DeckCheckDisplayMode) => void;
  sortBy: DeckCheckSort;
  setSortBy: (sortBy: DeckCheckSort) => void;
  sortDir: "asc" | "desc";
  setSortDir: (sortDir: "asc" | "desc") => void;
  maxColumns: number | null;
  setMaxColumns: (maxColumns: number | null) => void;
}

const DECK_CHECK_SORTS: readonly DeckCheckSort[] = ["deck", "id", "name", "domain", "energy"];

/**
 * Kept separate from the global card-browser `displayStore` so sizing the
 * checker doesn't change how /cards and /collections look.
 */
export const useDeckCheckViewStore = create<DeckCheckViewState>()(
  persist(
    (set) => ({
      wide: true,
      setWide: (wide) => set({ wide }),
      displayMode: "grid",
      setDisplayMode: (displayMode) => set({ displayMode }),
      sortBy: "deck",
      setSortBy: (sortBy) => set({ sortBy }),
      sortDir: "asc",
      setSortDir: (sortDir) => set({ sortDir }),
      maxColumns: null,
      setMaxColumns: (maxColumns) => set({ maxColumns }),
    }),
    {
      name: "deck-check-view",
      merge: mergeFields<DeckCheckViewState>({
        wide: pickBoolean,
        displayMode: pickEnum<DeckCheckDisplayMode>(["grid", "list"]),
        sortBy: pickEnum(DECK_CHECK_SORTS),
        sortDir: pickEnum(["asc", "desc"]),
        maxColumns: (value) =>
          typeof value === "number" && value >= 1 ? Math.floor(value) : undefined,
      }),
    },
  ),
);
