import type { Virtualizer } from "@tanstack/react-virtual";
import { useEffect, useEffectEvent, useState } from "react";

import type { VRow } from "@/features/cards/lib/card-grid-types";

interface UseStickyHeaderParams {
  multipleGroups: boolean;
  virtualRows: VRow[];
  rowStarts: number[];
  virtualizer: Virtualizer<Window, Element>;
  scrollMargin: number;
  stickyOffset: number;
  headerHeight: number;
}

export function useStickyHeader({
  multipleGroups,
  virtualRows,
  rowStarts,
  virtualizer,
  scrollMargin,
  stickyOffset,
  headerHeight,
}: UseStickyHeaderParams) {
  const [activeHeaderRow, setActiveHeaderRow] = useState<(VRow & { kind: "header" }) | null>(null);

  if (!multipleGroups && activeHeaderRow !== null) {
    setActiveHeaderRow(null);
  }

  const update = useEffectEvent((margin: number) => {
    if (!multipleGroups) {
      return;
    }
    const threshold = globalThis.scrollY - margin + stickyOffset;
    const measuredStarts = new Map(
      virtualizer.getVirtualItems().map((item) => [item.index, item.start - margin]),
    );

    // The last header whose row has fully scrolled past the threshold, so
    // the overlay never doubles up a header still sliding under the toolbar.
    let active: (VRow & { kind: "header" }) | null = null;
    let activeStart = 0;
    for (const [i, row] of virtualRows.entries()) {
      if (row.kind !== "header") {
        continue;
      }
      const start = measuredStarts.get(i) ?? rowStarts[i];
      if (start !== undefined && start <= threshold + 1) {
        active = row;
        activeStart = start;
      }
    }
    if (active && activeStart + headerHeight > threshold + 1) {
      active = null;
    }

    // Compare by set code to avoid re-renders from new object references.
    const resolved = active;
    setActiveHeaderRow((prev) => {
      const prevCode = prev?.group.id ?? null;
      const nextCode = resolved?.group.id ?? null;
      return prevCode === nextCode ? prev : resolved;
    });
  });

  useEffect(() => {
    if (!multipleGroups) {
      return;
    }
    const onScroll = () => update(scrollMargin);
    // Runs after paint: `update` forces a synchronous layout, and inline it
    // would land on the same commit as a filter change showing new cards.
    const frame = requestAnimationFrame(onScroll);
    globalThis.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      globalThis.removeEventListener("scroll", onScroll);
    };
  }, [multipleGroups, scrollMargin]);

  return activeHeaderRow;
}
