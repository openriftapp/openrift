import type { CardBanResponse } from "@openrift/shared/contracts/admin/card-bans";

export interface CardBanRow {
  id: string;
  cardId: string;
  formatId: string;
  formatName: string;
  bannedAt: string;
  reason: string | null;
  createdAt: Date;
}

export function toCardBanResponse(row: CardBanRow): CardBanResponse {
  return {
    id: row.id,
    cardId: row.cardId,
    formatId: row.formatId,
    formatName: row.formatName,
    bannedAt: row.bannedAt,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}
