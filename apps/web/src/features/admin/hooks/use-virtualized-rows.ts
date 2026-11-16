import { useState } from "react";

import { useWindowScrollMargin } from "@/hooks/use-window-scroll-margin";
import { useWindowVirtualizerFresh } from "@/lib/virtualizer-fresh";

const OVERSCAN = 20;

/** `useWindowVirtualizer` reports item start/end in document space, so callers
 *  subtract this `scrollMargin` in their spacer rows. */
export function useVirtualizedRows(rowCount: number, rowHeight: number, enabled = true) {
  const [tableAnchor, setTableAnchor] = useState<HTMLTableSectionElement | null>(null);
  const scrollMargin = useWindowScrollMargin(tableAnchor);

  const { virtualItems, totalSize } = useWindowVirtualizerFresh({
    enabled,
    count: rowCount,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
    scrollMargin,
  });

  return { tableAnchorRef: setTableAnchor, virtualItems, totalSize, scrollMargin };
}
