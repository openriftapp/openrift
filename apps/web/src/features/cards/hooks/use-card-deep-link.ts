import type { Printing } from "@openrift/shared/types/catalog";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import type { CardViewerItem } from "@/lib/card-viewer-types";
import { useSelectionStore } from "@/stores/selection-store";

interface Options {
  linkedPrintingId: string | undefined;
  printingsById: Record<string, Printing>;
  items: CardViewerItem[];
}

/**
 * `resetScroll: false`: TanStack Router's scroll-restoration otherwise fires
 * `window.scrollTo(0, 0)` and wipes out CardGrid's scroll-to-selected-card.
 * Selects after the replace commits; an earlier overlay push leaves `printingId` in the entry under it.
 */
export function useCardDeepLink({ linkedPrintingId, printingsById, items }: Options) {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (!linkedPrintingId || handled.current) {
      return;
    }
    const printing = printingsById[linkedPrintingId];
    if (!printing) {
      return;
    }
    handled.current = true;
    const selectAfterCleanup = async () => {
      await navigate({
        to: ".",
        search: ({ printingId: _printingId, ...rest }) => rest,
        replace: true,
        resetScroll: false,
      });
      useSelectionStore.getState().selectCard(printing, items, "printing");
    };
    void selectAfterCleanup();
  }, [linkedPrintingId, printingsById, items, navigate]);
}
