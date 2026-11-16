import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import type { GroupByField } from "@openrift/shared/types/search";
import type { ReactNode } from "react";
import { useLayoutEffect } from "react";

import type { CardTableProps } from "@/features/cards/components/card-viewer";
import { CardViewer } from "@/features/cards/components/card-viewer";
import { useGridFocusStore } from "@/features/cards/stores/grid-focus-store";
import { useResolvedSelection } from "@/hooks/use-resolved-selection";
import type { GroupInfo } from "@/lib/card-group-types";
import type { CardRenderContext, CardViewerItem } from "@/lib/card-viewer-types";

const EMPTY_SIBLINGS: Printing[] = [];

interface BrowserCardViewerProps {
  items: CardViewerItem[];
  totalItems: number;
  renderCard: (item: CardViewerItem, ctx: CardRenderContext) => ReactNode;
  setOrder?: GroupInfo[];
  collectionOrder?: GroupInfo[];
  groupBy?: GroupByField;
  groupDir?: "asc" | "desc";
  renderedCards: Printing[];
  printingsByCardId: Map<string, Printing[]>;
  view: "cards" | "printings";
  stale?: boolean;
  toolbar?: ReactNode;
  leftPane?: ReactNode;
  aboveGrid?: ReactNode;
  banner?: ReactNode;
  rightPane?: ReactNode;
  addStripHeight?: number;
  table?: CardTableProps;
  noResultsDescription?: ReactNode;
  children?: ReactNode;
}

/** Thin wrapper around CardViewer that bridges the selection store to grid props. */
export function BrowserCardViewer({
  items,
  renderedCards,
  printingsByCardId,
  view,
  ...rest
}: BrowserCardViewerProps) {
  const { card: selectedCard, item: selectedItem } = useResolvedSelection(items);

  // Falls back to cardId in cards-only view, where chevron-picked variants aren't in the grid items.
  const gridSelectedCard = selectedCard
    ? (renderedCards.find((c) => sideKey(c) === sideKey(selectedCard)) ??
      (view === "cards"
        ? renderedCards.find((c) => c.cardId === selectedCard.cardId)
        : undefined) ??
      selectedCard)
    : undefined;
  const gridSelectedId =
    selectedItem?.id ?? (gridSelectedCard ? sideKey(gridSelectedCard) : undefined);

  // Cells subscribe per item id; publishing before paint keeps the highlight in step with the grid.
  useLayoutEffect(() => {
    useGridFocusStore.getState().setSelectedItemId(gridSelectedId ?? null);
  }, [gridSelectedId]);

  const siblingPrintings = selectedCard
    ? (printingsByCardId.get(selectedCard.cardId) ?? EMPTY_SIBLINGS)
    : EMPTY_SIBLINGS;

  return (
    <CardViewer
      {...rest}
      items={items}
      selectedItemId={gridSelectedId}
      siblingPrintings={siblingPrintings}
    />
  );
}
