import type { Printing } from "@openrift/shared/types/catalog";
import { ArrowLeftIcon } from "lucide-react";
import { Suspense, lazy, useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  PrintingsHostProvider,
  usePrintingsHostState,
} from "@/features/cards/components/card-detail/printings-host";
import { CardDetailSkeleton } from "@/features/cards/components/selection-detail-pane";
import {
  closeOverlayHistoryEntry,
  useOverlayHistoryEntry,
} from "@/features/cards/hooks/use-overlay-history-entry";
import { useSelectionDetail } from "@/features/cards/hooks/use-selection-detail";
import { useDomainColors } from "@/hooks/use-domain-colors";
import type { CardViewerItem } from "@/lib/card-viewer-types";
import { getDomainTintStyle } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useSelectionStore } from "@/stores/selection-store";

const cardDetailImport = import("@/features/cards/components/card-detail/card-detail");
const CardDetail = lazy(async () => {
  const mod = await cardDetailImport;
  return { default: mod.CardDetail };
});

export function focusCatalogCard(printingId: string): void {
  const tile = document.querySelector<HTMLElement>(
    `[data-printing-id="${CSS.escape(printingId)}"]`,
  );
  if (!tile) {
    return;
  }
  const target = tile.matches("[tabindex]")
    ? tile
    : tile.querySelector<HTMLElement>("button, [tabindex]");
  target?.focus({ preventScroll: true });
  tile.scrollIntoView({ block: "nearest" });
}

export function WorkbenchCardDetail({
  items,
  printingsByCardId,
  showImages,
  onSearchAndClose,
  actions,
}: {
  items: CardViewerItem[];
  printingsByCardId: Map<string, Printing[]>;
  showImages: boolean;
  onSearchAndClose: (query: string) => void;
  actions?: (printing: Printing) => ReactNode;
}) {
  const closeDetail = useSelectionStore((s) => s.closeDetail);
  const domainColors = useDomainColors();
  const { expanded, host, slotRef } = usePrintingsHostState();
  const headingRef = useRef<HTMLDivElement>(null);

  const {
    selectedCard,
    siblingPrintings,
    handlePrevCard,
    handleNextCard,
    handleTagClick,
    handleKeywordClick,
    handleSelectPrinting,
    handleKeyDown,
    navLabel,
  } = useSelectionDetail({ items, printingsByCardId, onSearchAndClose, onDismiss: closeDetail });

  useOverlayHistoryEntry({ active: true, stateKey: "cardDetail", onPop: closeDetail });

  useEffect(() => {
    globalThis.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [role="dialog"], [role="menu"]')) {
        return;
      }
      event.preventDefault();
      closeOverlayHistoryEntry("cardDetail", closeDetail);
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [closeDetail]);

  if (!selectedCard) {
    return null;
  }

  const handleClose = () => closeOverlayHistoryEntry("cardDetail", closeDetail);

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Esc is handled for the whole detail region
    <section
      aria-label={m.cards_detail_title()}
      className="bg-card relative rounded-xl border p-4"
      style={getDomainTintStyle(selectedCard.card.domains, domainColors)}
      onKeyDown={handleKeyDown}
    >
      <div ref={headingRef} tabIndex={-1} className="outline-none">
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={handleClose}>
          <ArrowLeftIcon className="size-4" />
          {m.decks_workbench_detail_back()}
          <kbd className="text-muted-foreground ml-1 font-sans">Esc</kbd>
        </Button>
        <div inert={expanded} className="contents">
          <PrintingsHostProvider host={host}>
            <Suspense fallback={<CardDetailSkeleton />}>
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
              />
            </Suspense>
          </PrintingsHostProvider>
        </div>
      </div>
      <div
        ref={slotRef}
        className={cn("bg-card absolute inset-0 z-40 rounded-xl", !expanded && "hidden")}
      />
    </section>
  );
}
