import type { Printing } from "@openrift/shared/types/catalog";

import { CardDetailActions } from "@/features/cards/components/card-detail/card-detail-actions";
import { SelectionDetailOverlays } from "@/features/cards/components/selection-detail-overlays";
import { SelectionDetailPane } from "@/features/cards/components/selection-detail-pane";
import { useFilterActions } from "@/features/cards/hooks/use-card-filters";
import { useSearchAndCloseDetail } from "@/features/cards/hooks/use-search-and-close-detail";
import { useCardRowDispatch } from "@/features/cards/stores/card-row-actions-store";
import type { useWishEntries } from "@/features/groups/hooks/use-wish-entries";
import { useIsMobile } from "@/hooks/use-is-mobile";
import type { CardViewerItem } from "@/lib/card-viewer-types";

interface CollectionDetailProps {
  items: CardViewerItem[];
  printingsByCardId: Map<string, Printing[]>;
  showImages: boolean;
  collectionId: string | undefined;
  mode: "browse" | "select";
  wish: ReturnType<typeof useWishEntries>;
  onAddToWishlist: (printing: Printing) => void;
}

function useDetailWiring({
  printingsByCardId,
  collectionId,
  mode,
  wish,
  onAddToWishlist,
}: Omit<CollectionDetailProps, "items" | "showImages">) {
  const isMobile = useIsMobile();
  const { setSearch } = useFilterActions();
  const { dispatchIncrement, dispatchDecrement } = useCardRowDispatch();

  const searchAndClose = useSearchAndCloseDetail(setSearch);

  const actions =
    mode === "browse"
      ? (printing: Printing) => (
          <CardDetailActions
            printing={printing}
            siblings={printingsByCardId.get(printing.cardId)}
            collectionId={collectionId}
            wishEntries={wish.entriesForPrinting(printing.cardId, printing.printingId)}
            onAddToWishlist={onAddToWishlist}
            onIncrement={dispatchIncrement}
            onDecrement={dispatchDecrement}
          />
        )
      : undefined;

  return { isMobile, searchAndClose, actions };
}

/** The docked pane beside the grid; the phone gets the overlays instead. */
export function CollectionDetailPane({
  items,
  printingsByCardId,
  showImages,
  collectionId,
  mode,
  wish,
  onAddToWishlist,
}: CollectionDetailProps) {
  const { isMobile, searchAndClose, actions } = useDetailWiring({
    printingsByCardId,
    collectionId,
    mode,
    wish,
    onAddToWishlist,
  });

  if (isMobile) {
    return null;
  }

  return (
    <SelectionDetailPane
      items={items}
      printingsByCardId={printingsByCardId}
      showImages={showImages}
      onSearchAndClose={searchAndClose}
      actions={actions}
      collectionId={collectionId}
    />
  );
}

export function CollectionDetailOverlays({
  items,
  printingsByCardId,
  showImages,
  collectionId,
  mode,
  wish,
  onAddToWishlist,
}: CollectionDetailProps) {
  const { searchAndClose, actions } = useDetailWiring({
    printingsByCardId,
    collectionId,
    mode,
    wish,
    onAddToWishlist,
  });

  return (
    <SelectionDetailOverlays
      items={items}
      printingsByCardId={printingsByCardId}
      showImages={showImages}
      onSearchAndClose={searchAndClose}
      actions={actions}
      collectionId={collectionId}
    />
  );
}
