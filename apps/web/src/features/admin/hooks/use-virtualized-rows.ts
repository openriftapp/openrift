import { useRef, useState } from "react";

import { useScopeLayoutEffect } from "@/hooks/use-scope-effect";
import { useWindowVirtualizerFresh } from "@/lib/virtualizer-fresh";

const OVERSCAN = 20;

/** `useWindowVirtualizer` reports item start/end in document space, so callers
 *  subtract this `scrollMargin` in their spacer rows. */
export function useVirtualizedRows(rowCount: number, rowHeight: number, enabled = true) {
  const tableAnchorRef = useRef<HTMLTableSectionElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  // A changed row count moves the anchor, so the margin is measured again.
  useScopeLayoutEffect(rowCount, () => {
    const el = tableAnchorRef.current;
    if (el) {
      setScrollMargin(Math.round(el.getBoundingClientRect().top + globalThis.scrollY));
    }
  });

  const { virtualItems, totalSize } = useWindowVirtualizerFresh({
    enabled,
    count: rowCount,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
    scrollMargin,
  });

  return { tableAnchorRef, virtualItems, totalSize, scrollMargin };
}
