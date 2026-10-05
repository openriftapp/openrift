import type { MetaOverlayQueueRow } from "@openrift/shared/types/api/meta";

import type { MetaOverlayCardRow } from "../repositories/meta-overlays.js";

export function toMetaOverlayCardRows(
  cards: readonly MetaOverlayCardRow[],
): MetaOverlayQueueRow["cards"] {
  return cards.map((card) => ({
    lineNumber: card.lineNumber,
    zone: card.zone,
    quantity: card.quantity,
    cardName: card.cardName,
    cardId: card.cardId,
  }));
}

export function toMetaIgnoredEntry<Row extends { createdAt: Date }>(
  row: Row,
): Omit<Row, "createdAt"> & { createdAt: string } {
  return { ...row, createdAt: row.createdAt.toISOString() };
}
