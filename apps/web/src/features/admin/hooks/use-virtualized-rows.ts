import { useEffect, useState } from "react";

import { useWindowScrollMargin } from "@/hooks/use-window-scroll-margin";
import { useWindowVirtualizerFresh } from "@/lib/virtualizer-fresh";

const OVERSCAN = 20;

/** `useWindowVirtualizer` reports item start/end in document space, so callers
 *  subtract this `scrollMargin` in their spacer rows. */
export function useVirtualizedRows(rowCount: number, rowHeight: number, enabled = true) {
  const [tableAnchor, setTableAnchor] = useState<HTMLTableSectionElement | null>(null);
  const scrollMargin = useWindowScrollMargin(tableAnchor);

  const { virtualizer, virtualItems, totalSize } = useWindowVirtualizerFresh({
    enabled,
    count: rowCount,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
    scrollMargin,
  });

  // The virtualizer caches its measurements and does not watch `estimateSize`.
  useEffect(() => {
    virtualizer.measure();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- a new row height is the trigger
  }, [virtualizer, rowHeight]);

  return {
    tableAnchorRef: setTableAnchor,
    virtualItems,
    totalSize,
    scrollMargin,
    measureRow: virtualizer.measureElement,
  };
}
