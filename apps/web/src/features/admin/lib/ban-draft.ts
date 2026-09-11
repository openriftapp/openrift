import type { CardBanResponse } from "@openrift/shared/contracts/admin/card-bans";
import { formatDay } from "@openrift/shared/format-date";

export interface BanDraft {
  formatId: string;
  bannedAt: string;
  reason: string;
}

export interface BanInput {
  cardId: string;
  formatId: string;
  bannedAt: string;
  reason: string | null;
}

export function newBanDraft(formatId: string, today: Date = new Date()): BanDraft {
  return { formatId, bannedAt: formatDay(today), reason: "" };
}

export function banDraftFromBan(ban: CardBanResponse): BanDraft {
  return { formatId: ban.formatId, bannedAt: ban.bannedAt, reason: ban.reason ?? "" };
}

export function banDraftInput(cardId: string, draft: BanDraft): BanInput {
  const reason = draft.reason.trim();
  return { cardId, formatId: draft.formatId, bannedAt: draft.bannedAt, reason: reason || null };
}

export function isBanDraftComplete(draft: BanDraft): boolean {
  return draft.formatId !== "" && draft.bannedAt !== "";
}

export function selectableFormats<T extends { id: string }>(
  formats: readonly T[],
  bans: readonly CardBanResponse[],
): T[] {
  const taken = new Set(bans.map((ban) => ban.formatId));
  return formats.filter((format) => !taken.has(format.id));
}
