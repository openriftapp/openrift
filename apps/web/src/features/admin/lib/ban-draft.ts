import type { CardBanResponse } from "@openrift/shared/contracts/admin/card-bans";
import { formatDay } from "@openrift/shared/format-date";

/** A null circuit is the global ban; an empty `bannedAt` is allowed only on a circuit ban. */
export interface BanDraft {
  formatId: string;
  circuit: string | null;
  bannedAt: string;
  reason: string;
}

export interface BanInput {
  cardId: string;
  formatId: string;
  circuit: string | null;
  bannedAt: string | null;
  reason: string | null;
}

export function newBanDraft(formatId: string, today: Date = new Date()): BanDraft {
  return { formatId, circuit: null, bannedAt: formatDay(today), reason: "" };
}

export function banDraftFromBan(ban: CardBanResponse): BanDraft {
  return {
    formatId: ban.formatId,
    circuit: ban.circuit,
    bannedAt: ban.bannedAt ?? "",
    reason: ban.reason ?? "",
  };
}

export function banDraftInput(cardId: string, draft: BanDraft): BanInput {
  const reason = draft.reason.trim();
  return {
    cardId,
    formatId: draft.formatId,
    circuit: draft.circuit,
    bannedAt: draft.bannedAt === "" ? null : draft.bannedAt,
    reason: reason || null,
  };
}

export function isBanDraftComplete(draft: BanDraft): boolean {
  return draft.formatId !== "" && (draft.bannedAt !== "" || draft.circuit !== null);
}

/** Formats the card has no active ban in yet, for the draft's circuit. */
export function selectableFormats<T extends { id: string }>(
  formats: readonly T[],
  bans: readonly CardBanResponse[],
  circuit: string | null,
): T[] {
  const taken = new Set(bans.filter((ban) => ban.circuit === circuit).map((ban) => ban.formatId));
  return formats.filter((format) => !taken.has(format.id));
}
