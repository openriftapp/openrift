import type { Printing } from "@openrift/shared/types/catalog";
import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand";
import { createStore } from "zustand/vanilla";

import { useConstant } from "@/lib/use-constant";

interface DragPreviewState {
  preview: Printing[];
  selectionCount: number;
  selectionNoun: string;
  setPreview: (preview: Printing[], selectionCount: number, selectionNoun: string) => void;
}

export type DragPreviewStore = StoreApi<DragPreviewState>;

/**
 * The fanned printings and count a select-mode drag shows. Cells read the preview with a stable
 * selector, so a +/- click that doesn't change the selection skips re-rendering every cell.
 */
export function createDragPreviewStore(): DragPreviewStore {
  return createStore<DragPreviewState>()((set) => ({
    preview: [],
    selectionCount: 0,
    selectionNoun: "printing",
    setPreview: (preview, selectionCount, selectionNoun) =>
      set({ preview, selectionCount, selectionNoun }),
  }));
}

/** Creates the collection layout's store once and keeps it for the layout's lifetime. */
export function useOwnDragPreviewStore(): DragPreviewStore {
  const store = useConstant(createDragPreviewStore);
  return store;
}

export const DragPreviewStoreContext = createContext<DragPreviewStore | null>(null);

export function useDragPreviewStoreApi(): DragPreviewStore {
  const store = useContext(DragPreviewStoreContext);
  if (store === null) {
    throw new Error("useDragPreviewStore needs a CollectionLayout");
  }
  return store;
}

export function useDragPreviewStore<T>(selector: (state: DragPreviewState) => T): T {
  return useStore(useDragPreviewStoreApi(), selector);
}
