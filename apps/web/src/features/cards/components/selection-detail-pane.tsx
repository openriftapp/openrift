import type { Printing } from "@openrift/shared/types/catalog";
import { XIcon } from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Pane } from "@/components/layout/panes";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PrintingsHostProvider,
  usePrintingsHostState,
} from "@/features/cards/components/card-detail/printings-host";
import { useSelectionDetail } from "@/features/cards/hooks/use-selection-detail";
import type { CardViewerItem } from "@/lib/card-viewer-types";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";
import { useSelectionStore } from "@/stores/selection-store";

const cardDetailImport = import("@/features/cards/components/card-detail/card-detail");
const CardDetail = lazy(async () => {
  const mod = await cardDetailImport;
  return { default: mod.CardDetail };
});

interface SelectionDetailPaneProps {
  items: CardViewerItem[];
  printingsByCardId: Map<string, Printing[]>;
  showImages: boolean;
  onSearchAndClose: (query: string) => void;
  actions?: (printing: Printing) => ReactNode;
  collectionId?: string;
}

/** Stays mounted with an empty state when no card is selected; never unmounts. */
export function SelectionDetailPane({
  items,
  printingsByCardId,
  showImages,
  onSearchAndClose,
  actions,
  collectionId,
}: SelectionDetailPaneProps) {
  const closeDetail = useSelectionStore((s) => s.closeDetail);
  const paneDocked = useDisplayStore((s) => s.paneDocked);
  const setPaneDocked = useDisplayStore((s) => s.setPaneDocked);
  const { expanded, host, slotRef } = usePrintingsHostState();
  const [pane, setPane] = useState<HTMLElement | null>(null);
  const grownWidth = useGrownWidth(pane);

  // Closes the panel, not just the card: undocking alone would hand the
  // still-selected card to the modal.
  const handleClose = () => {
    setPaneDocked(false);
    closeDetail();
  };

  const {
    selectedCard,
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
    onDismiss: closeDetail,
  });

  if (!paneDocked) {
    return null;
  }

  return (
    // The sticky pane is its own stacking context, so only a z-index here lifts the grown slot over selected tiles.
    <Pane ref={setPane} className={cn("@md:block", expanded && "z-30")}>
      <div inert={expanded}>
        <PrintingsHostProvider host={host}>
          {selectedCard ? (
            <Suspense fallback={<CardDetailSkeleton />}>
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
            </Suspense>
          ) : (
            <PaneEmptyState onClose={handleClose} />
          )}
        </PrintingsHostProvider>
      </div>
      <div
        ref={slotRef}
        style={{ width: expanded ? grownWidth : undefined }}
        className={cn(
          "bg-background absolute top-0 right-0 z-40 flex h-[calc(100vh-var(--sticky-top))] w-full flex-col pt-3 transition-[width] duration-300 ease-out",
          !expanded && "invisible",
        )}
      />
    </Pane>
  );
}

function useGrownWidth(pane: HTMLElement | null): number | undefined {
  const [width, setWidth] = useState<number>();
  useEffect(() => {
    const row = pane?.parentElement;
    if (!pane || !row) {
      return;
    }
    const observer = new ResizeObserver(() =>
      setWidth(pane.getBoundingClientRect().right - row.getBoundingClientRect().left),
    );
    observer.observe(row);
    observer.observe(pane);
    return () => observer.disconnect();
  }, [pane]);
  return width;
}

function PaneEmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        aria-label={m.cards_detail_pane_hide()}
        className="absolute top-4 right-3"
      >
        <XIcon className="size-4" />
      </Button>
      <Empty className="h-40">
        <EmptyDescription>{m.cards_selection_detail_empty()}</EmptyDescription>
      </Empty>
    </div>
  );
}

export function CardDetailSkeleton() {
  return (
    <div className="bg-background rounded-lg px-3">
      <div className="hidden md:flex md:items-start md:justify-between md:gap-2 md:pt-4 md:pb-4">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="space-y-4 p-4 md:p-0 md:pb-4">
        <Skeleton className="aspect-card w-full rounded-xl" />
        <div className="flex justify-center gap-1.5">
          <Skeleton className="h-7 w-16 rounded-md" />
          <Skeleton className="h-7 w-16 rounded-md" />
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    </div>
  );
}
