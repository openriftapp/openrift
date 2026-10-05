import type { Printing } from "@openrift/shared/types/catalog";
import { lazy } from "react";
import type { ReactNode } from "react";

import { CardDetailDrawerShell } from "@/features/cards/components/card-detail/card-detail-shells";
import {
  closeOverlayHistoryEntry,
  useOverlayHistoryEntry,
} from "@/features/cards/hooks/use-overlay-history-entry";
import { useSelectionDetail } from "@/features/cards/hooks/use-selection-detail";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { useIsMobile } from "@/hooks/use-is-mobile";
import type { CardViewerItem } from "@/lib/card-viewer-types";
import { getDomainTintStyle } from "@/lib/domain";
import { useSelectionStore } from "@/stores/selection-store";

const cardDetailImport = import("@/features/cards/components/card-detail/card-detail");
const CardDetail = lazy(async () => {
  const mod = await cardDetailImport;
  return { default: mod.CardDetail };
});

interface SelectionMobileOverlayProps {
  items: CardViewerItem[];
  printingsByCardId: Map<string, Printing[]>;
  showImages: boolean;
  onSearchAndClose: (query: string) => void;
  actions?: (printing: Printing) => ReactNode;
  collectionId?: string;
}

export function SelectionMobileOverlay({
  items,
  printingsByCardId,
  showImages,
  onSearchAndClose,
  actions,
  collectionId,
}: SelectionMobileOverlayProps) {
  const closeDetail = useSelectionStore((s) => s.closeDetail);
  const isMobile = useIsMobile();
  const domainColors = useDomainColors();

  const handleClose = () => closeOverlayHistoryEntry("cardDetail", closeDetail);

  const {
    selectedCard,
    detailOpen,
    siblingPrintings,
    handlePrevCard,
    handleNextCard,
    handleTagClick,
    handleKeywordClick,
    handleSelectPrinting,
  } = useSelectionDetail({
    items,
    printingsByCardId,
    onSearchAndClose,
    onDismiss: handleClose,
  });

  useOverlayHistoryEntry({
    active: detailOpen && isMobile,
    stateKey: "cardDetail",
    onPop: closeDetail,
  });

  if (!isMobile || !selectedCard) {
    return null;
  }

  return (
    <CardDetailDrawerShell
      open={detailOpen}
      onClose={handleClose}
      style={getDomainTintStyle(selectedCard.card.domains, domainColors)}
    >
      <CardDetail
        printing={selectedCard}
        onClose={handleClose}
        showImages={showImages}
        onPrevCard={handlePrevCard}
        onNextCard={handleNextCard}
        onTagClick={handleTagClick}
        onKeywordClick={handleKeywordClick}
        printings={siblingPrintings}
        onSelectPrinting={handleSelectPrinting}
        actions={actions?.(selectedCard)}
        collectionId={collectionId}
      />
    </CardDetailDrawerShell>
  );
}
