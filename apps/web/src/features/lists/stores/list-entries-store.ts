import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";
import { create } from "zustand";

interface ListEntriesState {
  entryByItemId: Map<string, ListEntryDetailResponse>;
  entryByKey: Map<string, ListEntryDetailResponse>;
  // The printing each selectable entry shows in the grid. Selection-wide actions
  // run from the DnD layer, which has no access to the browser's items.
  printingByEntryId: Map<string, Printing>;
  setEntries: (
    entryByItemId: Map<string, ListEntryDetailResponse>,
    entryByKey: Map<string, ListEntryDetailResponse>,
    printingByEntryId: Map<string, Printing>,
  ) => void;
}

// Cells select their own entry via a per-key selector so an entry mutation
// only re-renders the cell whose entry actually changed.
export const useListEntriesStore = create<ListEntriesState>()((set) => ({
  entryByItemId: new Map(),
  entryByKey: new Map(),
  printingByEntryId: new Map(),
  setEntries: (entryByItemId, entryByKey, printingByEntryId) =>
    set({ entryByItemId, entryByKey, printingByEntryId }),
}));
