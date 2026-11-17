import { sideKey } from "@openrift/shared/printing-side";

import type { VRow } from "@/features/cards/lib/card-grid-types";

/** The virtual row holding a card, matched by item id or printing side key; -1 when absent. */
export function cardRowIndex(rows: VRow[], cardId: string): number {
  return rows.findIndex(
    (row) =>
      row.kind === "cards" &&
      row.items.some((item) => item.id === cardId || sideKey(item.printing) === cardId),
  );
}
