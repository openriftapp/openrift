import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { DeckOverviewGroup } from "@/features/decks/lib/deck-card-group";
import type { DeckOverviewSort } from "@/features/decks/lib/deck-overview-list-sort";
import type { FieldPicker } from "@/lib/persist-merge";
import { mergeFields, pickBoolean, pickEnum } from "@/lib/persist-merge";

export type DeckOverviewDisplayMode = "grid" | "list" | "stacks";

const MAX_PERSISTED_COLUMNS = 24;

interface DeckOverviewViewState {
  displayMode: DeckOverviewDisplayMode;
  setDisplayMode: (displayMode: DeckOverviewDisplayMode) => void;
  columns: number | null;
  setColumns: (columns: number | null) => void;
  preferOwnedPrintings: boolean;
  setPreferOwnedPrintings: (preferOwnedPrintings: boolean) => void;
  showAllCopies: boolean;
  setShowAllCopies: (showAllCopies: boolean) => void;
  showAllRuneCopies: boolean;
  setShowAllRuneCopies: (showAllRuneCopies: boolean) => void;
  sortBy: DeckOverviewSort;
  setSortBy: (sortBy: DeckOverviewSort) => void;
  sortDir: "asc" | "desc";
  setSortDir: (sortDir: "asc" | "desc") => void;
  groupBy: DeckOverviewGroup;
  setGroupBy: (groupBy: DeckOverviewGroup) => void;
  groupDir: "asc" | "desc";
  setGroupDir: (groupDir: "asc" | "desc") => void;
  statsOpen: boolean;
  setStatsOpen: (statsOpen: boolean) => void;
  showOwnershipBands: boolean;
  setShowOwnershipBands: (showOwnershipBands: boolean) => void;
  showPrices: boolean;
  setShowPrices: (showPrices: boolean) => void;
}

const DISPLAY_MODES: readonly DeckOverviewDisplayMode[] = ["grid", "list", "stacks"];

const SORTS: readonly DeckOverviewSort[] = [
  "default",
  "id",
  "name",
  "energy",
  "price",
  "rarity",
  "ownership",
];

const GROUPS: readonly DeckOverviewGroup[] = ["type", "energy", "domain", "ownership", "none"];

const DIRECTIONS: readonly ("asc" | "desc")[] = ["asc", "desc"];

// Anything that isn't a usable count, including the `thumbSize` step this replaced, falls back to Auto.
const pickColumnCount: FieldPicker<number | null> = (raw) =>
  typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= MAX_PERSISTED_COLUMNS
    ? raw
    : undefined;

/**
 * Kept separate from the global card-browser `displayStore` so switching the
 * overview to a list doesn't change how /cards and /collections look.
 */
export const useDeckOverviewViewStore = create<DeckOverviewViewState>()(
  persist(
    (set) => ({
      displayMode: "grid",
      setDisplayMode: (displayMode) => set({ displayMode }),
      columns: null,
      setColumns: (columns) => set({ columns }),
      preferOwnedPrintings: false,
      setPreferOwnedPrintings: (preferOwnedPrintings) => set({ preferOwnedPrintings }),
      showAllCopies: false,
      setShowAllCopies: (showAllCopies) => set({ showAllCopies }),
      showAllRuneCopies: false,
      setShowAllRuneCopies: (showAllRuneCopies) => set({ showAllRuneCopies }),
      sortBy: "default",
      setSortBy: (sortBy) => set({ sortBy }),
      sortDir: "asc",
      setSortDir: (sortDir) => set({ sortDir }),
      groupBy: "type",
      setGroupBy: (groupBy) => set({ groupBy }),
      groupDir: "asc",
      setGroupDir: (groupDir) => set({ groupDir }),
      statsOpen: true,
      setStatsOpen: (statsOpen) => set({ statsOpen }),
      showOwnershipBands: true,
      setShowOwnershipBands: (showOwnershipBands) => set({ showOwnershipBands }),
      showPrices: false,
      setShowPrices: (showPrices) => set({ showPrices }),
    }),
    {
      name: "deck-overview-view",
      // Validate on rehydrate: a hand-edited or stale blob must fall back to
      // defaults per field, never load junk view state.
      merge: mergeFields<DeckOverviewViewState>({
        displayMode: pickEnum(DISPLAY_MODES),
        columns: pickColumnCount,
        preferOwnedPrintings: pickBoolean,
        showAllCopies: pickBoolean,
        showAllRuneCopies: pickBoolean,
        sortBy: pickEnum(SORTS),
        sortDir: pickEnum(DIRECTIONS),
        groupBy: pickEnum(GROUPS),
        groupDir: pickEnum(DIRECTIONS),
        statsOpen: pickBoolean,
        showOwnershipBands: pickBoolean,
        showPrices: pickBoolean,
      }),
    },
  ),
);
