import type { Printing } from "@openrift/shared/types/catalog";
import type { GroupByField } from "@openrift/shared/types/search";
import type { ReactElement, ReactNode } from "react";

import {
  CardBrowserLayout,
  useCardBrowserLayoutOffsets,
} from "@/features/cards/components/card-browser-layout";
import { CardGrid } from "@/features/cards/components/card-grid";
import { CardTable } from "@/features/cards/components/card-table";
import type { CardTableSelection, TableRowSlotProps } from "@/features/cards/components/card-table";
import { useGridKeyboardNav } from "@/features/cards/hooks/use-grid-keyboard-nav";
import { useCardRowActionsStoreApi } from "@/features/cards/stores/card-row-actions-store";
import type { ActionsColumn } from "@/features/collections/lib/collection-table";
import { useIsMobile } from "@/hooks/use-is-mobile";
import type { GroupInfo } from "@/lib/card-group-types";
import type { CardRenderContext, CardViewerItem } from "@/lib/card-viewer-types";
import { useDisplayStore } from "@/stores/display-store";

export interface CardTableProps {
  actionsColumn: ActionsColumn;
  actionsCell?: ReactElement<TableRowSlotProps>;
  actionsLabel?: string;
  rowWrapper?: ReactElement<TableRowSlotProps & { children?: ReactNode }>;
  selection?: CardTableSelection;
}

interface CardViewerProps {
  items: CardViewerItem[];
  totalItems: number;
  renderCard: (item: CardViewerItem, ctx: CardRenderContext) => ReactNode;
  setOrder?: GroupInfo[];
  collectionOrder?: GroupInfo[];
  groupBy?: GroupByField;
  groupDir?: "asc" | "desc";
  selectedItemId?: string;
  returnToItemId?: string;
  /** `focusPending` is true when a grid tile holding the item will take the focus request. */
  onReturned?: (focusPending: boolean) => void;
  siblingPrintings?: Printing[];
  stale?: boolean;
  toolbar?: ReactNode;
  leftPane?: ReactNode;
  aboveGrid?: ReactNode;
  banner?: ReactNode;
  rightPane?: ReactNode;
  addStripHeight?: number;
  table?: CardTableProps;
  noResultsDescription?: ReactNode;
  pendingGrid?: ReactNode;
  children?: ReactNode;
}

/**
 * Outer structure (sticky offsets, slots) lives in {@link CardBrowserLayout};
 * this owns the grid logic and the switch between `CardGrid` and `CardTable`.
 * `pendingGrid` replaces both while the surface has nothing to list yet.
 */
export function CardViewer({
  items,
  totalItems,
  renderCard,
  setOrder,
  collectionOrder,
  groupBy,
  groupDir,
  selectedItemId,
  returnToItemId,
  onReturned,
  siblingPrintings,
  stale,
  toolbar,
  leftPane,
  aboveGrid,
  banner,
  rightPane,
  addStripHeight,
  table,
  noResultsDescription,
  pendingGrid,
  children,
}: CardViewerProps) {
  const displayMode = useDisplayStore((state) => state.displayMode);
  const isMobile = useIsMobile();
  const useTable = !isMobile && displayMode === "table" && table !== undefined;

  const rowActions = useCardRowActionsStoreApi();

  useGridKeyboardNav({ items, siblingPrintings, rowActions });

  return (
    <CardBrowserLayout
      toolbar={toolbar}
      leftPane={leftPane}
      aboveGrid={aboveGrid}
      banner={banner}
      rightPane={rightPane}
      stale={stale}
      gridSlot={
        pendingGrid ??
        (stale && items.length === 0 ? (
          <div className="flex flex-1 flex-col" />
        ) : useTable ? (
          <HydratedTable
            items={items}
            totalItems={totalItems}
            setOrder={setOrder}
            collectionOrder={collectionOrder}
            groupBy={groupBy}
            groupDir={groupDir}
            selectedItemId={selectedItemId}
            returnToItemId={returnToItemId}
            onReturned={() => onReturned?.(false)}
            table={table}
            noResultsDescription={noResultsDescription}
          />
        ) : (
          <HydratedGrid
            items={items}
            totalItems={totalItems}
            renderCard={renderCard}
            setOrder={setOrder}
            collectionOrder={collectionOrder}
            groupBy={groupBy}
            groupDir={groupDir}
            selectedItemId={selectedItemId}
            returnToItemId={returnToItemId}
            onReturned={onReturned}
            addStripHeight={addStripHeight}
            noResultsDescription={noResultsDescription}
          />
        ))
      }
    >
      {children}
    </CardBrowserLayout>
  );
}

type HydratedGridProps = Pick<
  CardViewerProps,
  | "items"
  | "totalItems"
  | "renderCard"
  | "setOrder"
  | "collectionOrder"
  | "groupBy"
  | "groupDir"
  | "selectedItemId"
  | "returnToItemId"
  | "onReturned"
  | "addStripHeight"
  | "noResultsDescription"
>;

function HydratedGrid(props: HydratedGridProps) {
  const { stickyOffset } = useCardBrowserLayoutOffsets();
  return <CardGrid {...props} stickyOffset={stickyOffset} />;
}

interface HydratedTableProps {
  items: CardViewerItem[];
  totalItems: number;
  setOrder?: GroupInfo[];
  collectionOrder?: GroupInfo[];
  groupBy?: GroupByField;
  groupDir?: "asc" | "desc";
  selectedItemId?: string;
  returnToItemId?: string;
  onReturned: () => void;
  table: CardTableProps;
  noResultsDescription?: ReactNode;
}

function HydratedTable({ table, ...props }: HydratedTableProps) {
  const { stickyOffset } = useCardBrowserLayoutOffsets();
  return <CardTable {...props} {...table} stickyOffset={stickyOffset} />;
}
