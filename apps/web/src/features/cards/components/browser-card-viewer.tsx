import type { Printing } from "@openrift/shared/types/catalog";
import type { GroupByField } from "@openrift/shared/types/search";
import type { ReactNode } from "react";

import type { CardTableProps } from "@/features/cards/components/card-viewer";
import { CardViewer } from "@/features/cards/components/card-viewer";
import { useGridHighlightId } from "@/features/cards/hooks/use-grid-highlight-id";
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
  returnToItemId?: string;
  onReturned?: (focusPending: boolean) => void;
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
  const { card: selectedCard, highlightId } = useGridHighlightId(items, view, renderedCards);

  const siblingPrintings = selectedCard
    ? (printingsByCardId.get(selectedCard.cardId) ?? EMPTY_SIBLINGS)
    : EMPTY_SIBLINGS;

  return (
    <CardViewer
      {...rest}
      items={items}
      selectedItemId={highlightId}
      siblingPrintings={siblingPrintings}
    />
  );
}
