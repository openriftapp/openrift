import { legendDisplayName } from "@openrift/shared/card-name";
import type { Printing } from "@openrift/shared/types/catalog";
import { Suspense, lazy, useState } from "react";

import { useCardDetailActionHost } from "@/features/cards/components/card-detail/card-detail-action-host";
import { CardDetailActions } from "@/features/cards/components/card-detail/card-detail-actions";
import {
  CardDetailDialogShell,
  CardDetailDrawerShell,
} from "@/features/cards/components/card-detail/card-detail-shells";
import { useCards } from "@/features/cards/hooks/use-cards";
import type { OverlayHistoryKey } from "@/features/cards/hooks/use-overlay-history-entry";
import {
  closeOverlayHistoryEntry,
  useOverlayHistoryEntry,
} from "@/features/cards/hooks/use-overlay-history-entry";
import { useCardDetailNavigation } from "@/features/cards/hooks/use-selection-detail";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { useIsMobile } from "@/hooks/use-is-mobile";
import type { CardViewerItem } from "@/lib/card-viewer-types";
import { getDomainTintStyle } from "@/lib/domain";
import { m } from "@/paraglide/messages.js";

const cardDetailImport = import("@/features/cards/components/card-detail/card-detail");
const CardDetail = lazy(async () => {
  const mod = await cardDetailImport;
  return { default: mod.CardDetail };
});

interface CardDetailOverlayProps {
  printingIds: string[];
  openPrintingId: string | null;
  onOpenPrintingIdChange: (printingId: string | null) => void;
  showImages: boolean;
  onSearchAndClose: (query: string) => void;
  historyKey: OverlayHistoryKey;
  /** Opt in to the owned-count stepper and wishlist button; off by default, this overlay is read-only. */
  allowCollectionEdits?: boolean;
}

/**
 * A card detail overlay a surface drives itself, by printing id: the fullscreen
 * drawer on phones, the two-column dialog on desktop. Unlike a card-browser
 * surface, it does not touch the global selection store.
 */
export function CardDetailOverlay(props: CardDetailOverlayProps) {
  if (props.openPrintingId === null) {
    return null;
  }
  // The catalog read suspends; every host has it cached by the time it can show
  // a row, so the null fallback only ever covers a cold cache.
  return (
    <Suspense fallback={null}>
      <CardDetailOverlayContent {...props} />
    </Suspense>
  );
}

function CardDetailOverlayContent({
  printingIds,
  openPrintingId,
  onOpenPrintingIdChange,
  showImages,
  onSearchAndClose,
  historyKey,
  allowCollectionEdits = false,
}: CardDetailOverlayProps) {
  const { printingsById, printingsByCardId } = useCards();
  const { inbox, canAdd, addCopy, removeCopy, wish, setWishTarget, hosts } =
    useCardDetailActionHost({ printingsByCardId, enabled: allowCollectionEdits });
  const isMobile = useIsMobile();
  const domainColors = useDomainColors();

  // Keyed by forPrintingId so moving to another row drops the pick without an effect.
  const [picked, setPicked] = useState<{ forPrintingId: string; printing: Printing } | null>(null);

  const items: CardViewerItem[] = printingIds.flatMap((id) => {
    const printing = printingsById[id];
    return printing ? [{ id, printing }] : [];
  });

  const selectedIndex = items.findIndex((item) => item.id === openPrintingId);
  const pickedPrinting = picked?.forPrintingId === openPrintingId ? picked.printing : undefined;
  const rowPrinting = openPrintingId === null ? undefined : printingsById[openPrintingId];
  const selectedCard = pickedPrinting ?? rowPrinting ?? null;

  const handleClose = () => {
    closeOverlayHistoryEntry(historyKey, () => {
      setPicked(null);
      onOpenPrintingIdChange(null);
    });
  };

  const {
    siblingPrintings,
    handlePrevCard,
    handleNextCard,
    handleTagClick,
    handleKeywordClick,
    handleSelectPrinting,
    handleKeyDown,
    navLabel,
  } = useCardDetailNavigation({
    items,
    printingsByCardId,
    onSearchAndClose,
    onDismiss: handleClose,
    selectedCard,
    selectedIndex,
    setSelectedCard: (printing) => {
      if (openPrintingId !== null) {
        setPicked({ forPrintingId: openPrintingId, printing });
      }
    },
    navigateToIndex: (_index, printing) => {
      setPicked(null);
      onOpenPrintingIdChange(printing.id);
    },
  });

  useOverlayHistoryEntry({
    active: true,
    stateKey: historyKey,
    onPop: () => onOpenPrintingIdChange(null),
  });

  if (selectedCard === null) {
    return null;
  }

  const tint = getDomainTintStyle(selectedCard.card.domains, domainColors);
  const cardName = legendDisplayName(selectedCard.card);
  const actions = allowCollectionEdits ? (
    <CardDetailActions
      printing={selectedCard}
      siblings={printingsByCardId.get(selectedCard.cardId)}
      wishEntries={wish.entriesForPrinting(selectedCard.cardId, selectedCard.id)}
      onAddToWishlist={setWishTarget}
      onIncrement={addCopy}
      onDecrement={removeCopy}
      incrementDisabled={!canAdd}
      addLabel={
        inbox ? m.card_detail_add_card_to({ card: cardName, collection: inbox.name }) : undefined
      }
    />
  ) : undefined;

  const detailProps = {
    printing: selectedCard,
    showImages,
    onPrevCard: handlePrevCard,
    onNextCard: handleNextCard,
    onTagClick: handleTagClick,
    onKeywordClick: handleKeywordClick,
    printings: siblingPrintings,
    onSelectPrinting: handleSelectPrinting,
    actions,
  };
  const after = allowCollectionEdits ? hosts : undefined;

  if (isMobile) {
    return (
      <CardDetailDrawerShell onClose={handleClose} style={tint} after={after}>
        <CardDetail {...detailProps} onClose={handleClose} />
      </CardDetailDrawerShell>
    );
  }

  return (
    <CardDetailDialogShell
      onClose={handleClose}
      style={tint}
      onKeyDown={handleKeyDown}
      after={after}
    >
      <CardDetail {...detailProps} layout="modal" navLabel={navLabel} />
    </CardDetailDialogShell>
  );
}
