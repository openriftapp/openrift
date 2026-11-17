import type { Virtualizer } from "@tanstack/react-virtual";

import { STICKY_GROUP_LABEL_BAND } from "@/features/cards/lib/card-grid-constants";
import type { VRow } from "@/features/cards/lib/card-grid-types";

/** Where a card row scrolls to so the sticky group label does not cover it. */
function cardRowScrollTarget(
  rows: readonly VRow[],
  rowIndex: number,
  multipleGroups: boolean,
): { rowIndex: number; labelBand: number } {
  if (!multipleGroups) {
    return { rowIndex, labelBand: 0 };
  }
  if (rows[rowIndex - 1]?.kind === "header") {
    return { rowIndex: rowIndex - 1, labelBand: 0 };
  }
  return { rowIndex, labelBand: STICKY_GROUP_LABEL_BAND };
}

export function scrollCardRowIntoView(
  virtualizer: Virtualizer<Window, Element>,
  rows: readonly VRow[],
  rowIndex: number,
  multipleGroups: boolean,
): void {
  const target = cardRowScrollTarget(rows, rowIndex, multipleGroups);
  if (target.labelBand === 0) {
    virtualizer.scrollToIndex(target.rowIndex, { align: "start" });
    return;
  }
  const offset = virtualizer.getOffsetForIndex(target.rowIndex, "start");
  if (offset) {
    virtualizer.scrollToOffset(offset[0] - target.labelBand);
  }
}
