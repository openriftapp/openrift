import type { Printing } from "@openrift/shared/types/catalog";
import { lazy, useRef } from "react";
import type { ReactNode } from "react";

import { CardDetailDialogShell } from "@/features/cards/components/card-detail/card-detail-shells";
import {
  closeOverlayHistoryEntry,
  hasOverlayHistoryEntry,
  useOverlayHistoryEntry,
} from "@/features/cards/hooks/use-overlay-history-entry";
import { useSelectionDetail } from "@/features/cards/hooks/use-selection-detail";
import { useDomainColors } from "@/hooks/use-domain-colors";
import type { CardViewerItem } from "@/lib/card-viewer-types";
import { getDomainTintStyle } from "@/lib/domain";
import { useDisplayStore } from "@/stores/display-store";
import { useSelectionStore } from "@/stores/selection-store";

const cardDetailImport = import("@/features/cards/components/card-detail/card-detail");
const CardDetail = lazy(async () => {
  const mod = await cardDetailImport;
  return { default: mod.CardDetail };
});

interface SelectionDetailModalProps {
  items: CardViewerItem[];
  printingsByCardId: Map<string, Printing[]>;
  showImages: boolean;
  onSearchAndClose: (query: string) => void;
  actions?: (printing: Printing) => ReactNode;
  collectionId?: string;
  docking?: boolean;
}

/**
 * Arrow-key navigation is not handled here: `useGridKeyboardNav` already
 * steps the selection from a window listener, so a second handler here would
 * double-step.
 */
export function SelectionDetailModal({
  items,
  printingsByCardId,
  showImages,
  onSearchAndClose,
  actions,
  collectionId,
  docking = true,
}: SelectionDetailModalProps) {
  const closeDetail = useSelectionStore((s) => s.closeDetail);
  const paneDocked = useDisplayStore((s) => s.paneDocked);
  const setPaneDocked = useDisplayStore((s) => s.setPaneDocked);
  const domainColors = useDomainColors();

  const {
    selectedCard,
    detailOpen,
    siblingPrintings,
    handlePrevCard,
    handleNextCard,
    handleTagClick,
    handleKeywordClick,
    handleSelectPrinting,
    handleKeyDown,
    navLabel,
  } = useSelectionDetail({
    items,
    printingsByCardId,
    onSearchAndClose,
    onDismiss: closeDetail,
  });

  const open = detailOpen && (!docking || !paneDocked) && selectedCard !== null;

  // Docking hands the card to the pane, so the history entry has to be popped
  // without the pop being read as a dismissal.
  const dockingRef = useRef(false);

  useOverlayHistoryEntry({
    active: open,
    stateKey: "cardDetail",
    onPop: () => {
      if (dockingRef.current) {
        dockingRef.current = false;
        return;
      }
      closeDetail();
    },
  });

  if (!open) {
    return null;
  }

  const handleClose = () => closeOverlayHistoryEntry("cardDetail", closeDetail);

  const handleDock = () => {
    if (hasOverlayHistoryEntry("cardDetail")) {
      dockingRef.current = true;
      history.back();
    }
    setPaneDocked(true);
  };

  return (
    <CardDetailDialogShell
      onClose={handleClose}
      style={getDomainTintStyle(selectedCard.card.domains, domainColors)}
      onKeyDown={handleKeyDown}
    >
      <CardDetail
        printing={selectedCard}
        layout="modal"
        showImages={showImages}
        onPrevCard={handlePrevCard}
        onNextCard={handleNextCard}
        onTagClick={handleTagClick}
        onKeywordClick={handleKeywordClick}
        printings={siblingPrintings}
        onSelectPrinting={handleSelectPrinting}
        actions={actions?.(selectedCard)}
        collectionId={collectionId}
        navLabel={navLabel}
        onDock={docking ? handleDock : undefined}
      />
    </CardDetailDialogShell>
  );
}
