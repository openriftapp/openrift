import type { ReactNode } from "react";

import type { GridSelectionStore } from "@/features/cards/stores/grid-selection-store";
import {
  createGridSelectionStore,
  GridSelectionStoreContext,
} from "@/features/cards/stores/grid-selection-store";
import type { DragPreviewStore } from "@/features/collections/stores/drag-preview-store";
import {
  createDragPreviewStore,
  DragPreviewStoreContext,
} from "@/features/collections/stores/drag-preview-store";

interface LayoutStores {
  gridSelection?: GridSelectionStore;
  dragPreview?: DragPreviewStore;
}

/** Mounts children inside the grid selection and drag preview stores a CollectionLayout owns. */
export function LayoutStoresProvider({
  gridSelection,
  dragPreview,
  children,
}: Required<LayoutStores> & { children: ReactNode }) {
  return (
    <GridSelectionStoreContext value={gridSelection}>
      <DragPreviewStoreContext value={dragPreview}>{children}</DragPreviewStoreContext>
    </GridSelectionStoreContext>
  );
}

/** A render `wrapper` over `LayoutStoresProvider`; stores left out are created once per wrapper. */
export function layoutStoresWrapper({
  gridSelection = createGridSelectionStore(),
  dragPreview = createDragPreviewStore(),
}: LayoutStores = {}) {
  return function LayoutStoresWrapper({ children }: { children: ReactNode }) {
    return (
      <LayoutStoresProvider gridSelection={gridSelection} dragPreview={dragPreview}>
        {children}
      </LayoutStoresProvider>
    );
  };
}
