import type { Printing } from "@openrift/shared/types/catalog";
import { XIcon } from "lucide-react";
import { Suspense, lazy, useRef } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pressable } from "@/components/ui/pressable";
import { Skeleton } from "@/components/ui/skeleton";
import { textLinkVariants } from "@/components/ui/text-link";
import { useSelectionDetail } from "@/features/cards/hooks/use-selection-detail";
import {
  closeOverlayHistoryEntry,
  hasOverlayHistoryEntry,
  useOverlayHistoryEntry,
} from "@/features/stage/hooks/use-overlay-history-entry";
import { useDomainColors } from "@/hooks/use-domain-colors";
import type { CardViewerItem } from "@/lib/card-viewer-types";
import { getDomainTintStyle } from "@/lib/domain";
import { m } from "@/paraglide/messages.js";
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

  const open = detailOpen && !paneDocked && selectedCard !== null;

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
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          handleClose();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-[860px]"
        style={getDomainTintStyle(selectedCard.card.domains, domainColors)}
        onKeyDown={handleKeyDown}
        showCloseButton={false}
      >
        <DialogClose
          render={<Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />}
          // Must match the pane and mobile drawer's close button label: one locator finds all three.
          aria-label={m.cards_detail_close()}
        >
          <XIcon className="size-4" />
        </DialogClose>
        <DialogHeader className="sr-only">
          <DialogTitle>{m.cards_detail_title()}</DialogTitle>
          <DialogDescription>{m.cards_detail_description()}</DialogDescription>
        </DialogHeader>
        <Suspense fallback={<CardDetailModalSkeleton />}>
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
            navLabel={navLabel}
            footerSlot={
              <span className="text-muted-foreground text-xs">
                {m.cards_detail_dock_prompt()}{" "}
                <Pressable onClick={handleDock} className={textLinkVariants({ variant: "muted" })}>
                  {m.cards_detail_dock_action()}
                </Pressable>
              </span>
            }
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Mirrors the modal's two-column layout: the pane's skeleton puts an
 * `aspect-card` block at full width, which at 860px is ~1150px tall and made
 * the dialog open oversized before snapping down.
 */
function CardDetailModalSkeleton() {
  return (
    <div className="@container flex flex-col gap-4">
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid gap-5 @2xl:grid-cols-[340px_minmax(0,1fr)]">
        <Skeleton className="aspect-card w-full rounded-xl" />
        <div className="min-w-0 space-y-4">
          <div className="flex gap-1.5">
            <Skeleton className="h-7 w-16 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
