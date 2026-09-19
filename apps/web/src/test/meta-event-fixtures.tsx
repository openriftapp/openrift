import type {
  MetaEventDetail,
  MetaEventField,
  MetaEventMatch,
  MetaEventPhase,
  MetaEventPlayer,
  MetaEventStandingsResponse,
  MetaStandingsRow,
} from "@openrift/shared/types/api/meta";
import { stringifyUnknown } from "@openrift/shared/utils";
import type { ReactNode } from "react";

/**
 * Fixtures and the router stub the event-page component tests share, so the
 * five sections of one page are not each described by their own idea of what a
 * standings row looks like.
 */

/** A deckless entry unless overridden, which is most of a real field. */
export function metaPlayer(overrides: Partial<MetaEventPlayer> = {}): MetaEventPlayer {
  return {
    id: "p-1",
    rank: 1,
    rankIsTier: false,
    playerName: "Ana",
    playerKey: "u1001",
    wins: 6,
    losses: 1,
    draws: null,
    legend: {
      cardId: "card-yasuo",
      name: "Yasuo, the Unforgiven",
      slug: "yasuo-the-unforgiven",
      imageId: null,
      domains: ["fury"],
      archiveSlug: "yasuo-yasuo-the-unforgiven",
    },
    champion: null,
    deckId: null,
    deckName: null,
    shareToken: null,
    listStatus: "none",
    ...overrides,
  };
}

/** A standings row as the API serves it: an entry with the run its strip draws. */
export function metaRow(overrides: Partial<MetaStandingsRow> = {}): MetaStandingsRow {
  const { rounds, ...player } = overrides;
  return { ...metaPlayer(player), rounds: rounds ?? [] };
}

/** One page of standings, the whole field by default. */
export function metaStandings(
  players: readonly MetaStandingsRow[],
  total = players.length,
): MetaEventStandingsResponse {
  return { players: [...players], total };
}

/** What the page states about the field: placings and nothing else unless overridden. */
export function metaField(overrides: Partial<MetaEventField> = {}): MetaEventField {
  return {
    withLists: 0,
    hasLegends: false,
    hasRecords: false,
    hasRuns: false,
    legends: [],
    cutLine: null,
    progress: null,
    ...overrides,
  };
}

/** A small store event unless overridden. */
export function metaEvent(overrides: Partial<MetaEventDetail> = {}): MetaEventDetail {
  return {
    id: "evt",
    slug: "summoner-skirmish",
    name: "Summoner Skirmish",
    eventDate: "2026-08-01",
    format: "freeform",
    playerCount: 64,
    organizer: "LGS Berlin",
    tier: "local",
    status: "complete",
    country: null,
    location: null,
    playerRowCount: 0,
    deckCount: 0,
    topFinishes: [],
    notes: null,
    sourceCheckedAt: null,
    sources: [],
    contributors: [],
    ...overrides,
  };
}

/** A decided top-cut game unless overridden. */
export function metaMatch(overrides: Partial<MetaEventMatch> = {}): MetaEventMatch {
  return {
    phaseOrder: 2,
    roundNumber: 1,
    tableNumber: 1,
    isBye: false,
    isDraw: false,
    player1Id: "p-1",
    player2Id: "p-2",
    winnerId: "p-1",
    gamesWonP1: 2,
    gamesWonP2: 0,
    ...overrides,
  };
}

/** The top-8 cut unless overridden. */
export function metaPhase(overrides: Partial<MetaEventPhase> = {}): MetaEventPhase {
  return {
    phaseOrder: 2,
    name: "Phase 3",
    roundType: "RANKED_SINGLE_ELIMINATION",
    roundCount: 3,
    rankRequired: 8,
    maxGameWins: 2,
    ...overrides,
  };
}

interface StubLinkProps {
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  className?: string;
  children?: ReactNode;
}

/** Renders the href it would navigate to, search params included. */
export function StubLink({ to = "", params, search, className, children }: StubLinkProps) {
  let path = to;
  for (const [key, value] of Object.entries(params ?? {})) {
    path = path.replace(`$${key}`, value);
  }
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search ?? {})) {
    if (value !== undefined) {
      query.set(key, stringifyUnknown(value));
    }
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return (
    <a href={`${path}${suffix}`} className={className}>
      {children}
    </a>
  );
}
