import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import { useLayoutEffect } from "react";

import { useGridFocusStore } from "@/features/cards/stores/grid-focus-store";
import { useResolvedSelection } from "@/hooks/use-resolved-selection";
import type { CardViewerItem } from "@/lib/card-viewer-types";
import type { ResolvedSelection } from "@/lib/resolve-selection";

type GridView = "cards" | "printings" | "copies";

interface GridHighlight extends ResolvedSelection {
  highlightId: string | undefined;
}

function matchCard<T>(
  entries: readonly T[],
  printingOf: (entry: T) => Printing,
  card: Printing,
  view: GridView,
): T | undefined {
  const key = sideKey(card);
  return (
    entries.find((entry) => sideKey(printingOf(entry)) === key) ??
    (view === "cards"
      ? entries.find((entry) => printingOf(entry).cardId === card.cardId)
      : undefined)
  );
}

/**
 * Resolves the selection against the grid's current items and publishes the tile id to
 * highlight. With `renderedCards`, a card without a tile still highlights by its side key.
 */
export function useGridHighlightId(
  items: readonly CardViewerItem[],
  view: GridView,
  renderedCards?: readonly Printing[],
): GridHighlight {
  const selection = useResolvedSelection(items);
  const { card, item } = selection;
  let highlightId = item?.id;
  if (highlightId === undefined && card) {
    highlightId = renderedCards
      ? sideKey(matchCard(renderedCards, (printing) => printing, card, view) ?? card)
      : matchCard(items, (entry) => entry.printing, card, view)?.id;
  }

  // Cells subscribe per item id so the whole grid does not re-render; publishing
  // before paint keeps the highlight in step with the grid.
  useLayoutEffect(() => {
    useGridFocusStore.getState().setSelectedItemId(highlightId ?? null);
  }, [highlightId]);

  return { ...selection, highlightId };
}
