import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import type { RowSelectionStore } from "@/features/admin/stores/row-selection-store";
import { selectedRowKeys } from "@/features/admin/stores/row-selection-store";

export interface RowSelection {
  store: RowSelectionStore;
  scope: string;
  selected: ReadonlySet<string>;
  clear: () => void;
}

export function useRowSelection(store: RowSelectionStore, scope: string): RowSelection {
  const keys = useStore(
    store,
    useShallow((state) => selectedRowKeys(state, scope)),
  );
  const clear = useStore(store, (state) => state.clear);
  return { store, scope, selected: new Set(keys), clear };
}
