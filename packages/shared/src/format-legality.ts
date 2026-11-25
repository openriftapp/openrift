/**
 * Card legality per format and competitive circuit. A circuit row replaces the
 * global row of the same key there: a card and format for bans, a format and
 * set for set windows. Without a circuit row the global row applies.
 */

import { todayUtc } from "./format-date.js";
import type { Card, CardBan, CircuitCardBan } from "./types/catalog.js";
import { WellKnown } from "./well-known.js";

/** A null `legalFrom` is announced without a date. `legalUntil` is the first day the set is out. */
export interface FormatSetWindow {
  formatId: string;
  setSlug: string;
  circuit?: string;
  legalFrom: string | null;
  legalUntil?: string;
}

export type SetLegality =
  | { status: "legal" }
  | { status: "upcoming"; from?: string }
  | { status: "rotated"; until: string }
  | { status: "outside" };

export interface LegalityScope {
  circuit?: string;
  day?: string;
}

/** What a viewer's legality reads need besides the card: their circuit and the set windows. */
export interface LegalityContext {
  circuit?: string;
  windows: readonly FormatSetWindow[];
}

const LEGAL: SetLegality = { status: "legal" };

/** The ban format whose set windows a deck format follows; undefined means no set restriction. */
export function setWindowFormatFor(deckFormat: string | null | undefined): string | undefined {
  return deckFormat === WellKnown.deckFormat.CONSTRUCTED
    ? WellKnown.banFormat.CONSTRUCTED
    : undefined;
}

interface BanRow {
  formatId: string;
  circuit: string | null;
  bannedAt: string | null;
  unbannedAt: string | null;
}

/** The rows that decide a circuit's bans: its own, plus the global rows of formats it has none for. */
function rowsForCircuit<T extends BanRow>(rows: readonly T[], circuit?: string): T[] {
  const regional = circuit ? rows.filter((row) => row.circuit === circuit) : [];
  const replaced = new Set(regional.map((row) => row.formatId));
  return [
    ...rows.filter((row) => row.circuit === null && !replaced.has(row.formatId)),
    ...regional,
  ];
}

function isRowInEffect(row: BanRow, day: string): boolean {
  return (
    row.bannedAt !== null &&
    row.bannedAt <= day &&
    (row.unbannedAt === null || row.unbannedAt > day)
  );
}

/**
 * The card's bans in effect and scheduled for a circuit. A circuit's undated
 * rows count as neither: the card stays legal there until a date is set.
 */
export function cardBansFor(
  card: Pick<Card, "bans" | "upcomingBans" | "circuitBans">,
  scope: LegalityScope = {},
): Pick<Card, "bans" | "upcomingBans"> {
  const { circuit } = scope;
  if (!circuit || !card.circuitBans?.some((ban) => ban.circuit === circuit)) {
    return { bans: card.bans, upcomingBans: card.upcomingBans };
  }
  const day = scope.day ?? todayUtc();
  const rows: (CircuitCardBan | (CardBan & { circuit: null; unbannedAt: null }))[] = [
    ...[...card.bans, ...card.upcomingBans].map((ban) => ({
      ...ban,
      circuit: null,
      unbannedAt: null,
    })),
    ...card.circuitBans,
  ];
  const bans: CardBan[] = [];
  const upcomingBans: CardBan[] = [];
  for (const row of rowsForCircuit(rows, circuit)) {
    if (row.bannedAt === null) {
      continue;
    }
    const ban = {
      formatId: row.formatId,
      formatName: row.formatName,
      bannedAt: row.bannedAt,
      reason: row.reason,
    };
    if (isRowInEffect(row, day)) {
      bans.push(ban);
    } else if (row.unbannedAt === null && row.bannedAt > day) {
      upcomingBans.push(ban);
    }
  }
  return { bans, upcomingBans };
}

/** The card's bans in effect for the context's circuit; no context means the global list. */
export function bansInEffect(
  card: Pick<Card, "bans" | "upcomingBans" | "circuitBans">,
  legality?: LegalityContext,
): CardBan[] {
  return legality?.circuit ? cardBansFor(card, legality).bans : card.bans;
}

/** The card's Standard set status for the context; no context means no set restriction. */
export function standardSetLegality(
  card: Pick<Card, "numberedSetSlugs">,
  legality?: LegalityContext,
): SetLegality {
  return legality
    ? cardSetLegality(
        card.numberedSetSlugs,
        legality.windows,
        WellKnown.banFormat.CONSTRUCTED,
        legality.circuit ? { circuit: legality.circuit } : {},
      )
    : LEGAL;
}

/** Server-side form over raw rows: the ban format ids in effect for a card on `day`. */
export function banFormatsInEffect(
  rows: readonly BanRow[],
  scope: { circuit?: string; day: string },
): Set<string> {
  return new Set(
    rowsForCircuit(rows, scope.circuit)
      .filter((row) => isRowInEffect(row, scope.day))
      .map((row) => row.formatId),
  );
}

/** Card ids banned in `formatId` on the scope's day, from rows of many cards. */
export function cardIdsBannedIn(
  rows: readonly {
    cardId: string;
    formatId: string;
    circuit: string | null;
    bannedAt: string | null;
    unbannedAt: string | null;
  }[],
  formatId: string,
  scope: { circuit?: string; day: string },
): Set<string> {
  const banned = new Set<string>();
  for (const [cardId, cardRows] of Map.groupBy(rows, (row) => row.cardId)) {
    if (banFormatsInEffect(cardRows, scope).has(formatId)) {
      banned.add(cardId);
    }
  }
  return banned;
}

function windowsFor(
  windows: readonly FormatSetWindow[],
  formatId: string,
  circuit?: string,
): Map<string, FormatSetWindow> {
  const bySet = new Map<string, FormatSetWindow>();
  for (const window of windows) {
    if (window.formatId === formatId && window.circuit === undefined) {
      bySet.set(window.setSlug, window);
    }
  }
  if (circuit) {
    for (const window of windows) {
      if (window.formatId === formatId && window.circuit === circuit) {
        bySet.set(window.setSlug, window);
      }
    }
  }
  return bySet;
}

function windowLegality(window: FormatSetWindow, day: string): SetLegality {
  if (window.legalFrom === null) {
    return { status: "upcoming" };
  }
  if (day < window.legalFrom) {
    return { status: "upcoming", from: window.legalFrom };
  }
  if (window.legalUntil !== undefined && day >= window.legalUntil) {
    return { status: "rotated", until: window.legalUntil };
  }
  return LEGAL;
}

/**
 * A card is legal while any set it is numbered in is (Tournament Rules 601.2.a).
 * A format with no windows at all has no set restriction.
 */
export function cardSetLegality(
  numberedSetSlugs: readonly string[],
  windows: readonly FormatSetWindow[],
  formatId: string,
  scope: LegalityScope = {},
): SetLegality {
  const bySet = windowsFor(windows, formatId, scope.circuit);
  if (bySet.size === 0) {
    return LEGAL;
  }
  const day = scope.day ?? todayUtc();
  let upcoming: SetLegality | undefined;
  let rotated: { status: "rotated"; until: string } | undefined;
  for (const slug of numberedSetSlugs) {
    const window = bySet.get(slug);
    if (!window) {
      continue;
    }
    const legality = windowLegality(window, day);
    if (legality.status === "legal") {
      return LEGAL;
    }
    if (legality.status === "upcoming") {
      const earlier =
        upcoming?.status === "upcoming" &&
        (upcoming.from === undefined ||
          (legality.from !== undefined && legality.from < upcoming.from));
      if (!upcoming || earlier) {
        upcoming = legality;
      }
    } else if (legality.status === "rotated" && (!rotated || legality.until > rotated.until)) {
      rotated = legality;
    }
  }
  return upcoming ?? rotated ?? { status: "outside" };
}
