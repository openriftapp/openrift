import { todayUtc } from "@openrift/shared/set-release";
import type {
  MetaEventStatus,
  MetaEventTier,
  MetaListStatus,
  MetaPlayerOverlayField,
} from "@openrift/shared/types/enums";
import { META_PLAYER_OVERLAY_FIELDS } from "@openrift/shared/types/enums";

import { m } from "@/paraglide/messages.js";

// The deck share image also uses these; they live in `shared` for both to import.
export { formatRank, formatRecord } from "@openrift/shared/meta-standings";

export function metaListStatusLabels(): Record<MetaListStatus, string> {
  return {
    full: m.meta_list_status_full(),
    partial: m.meta_list_status_partial(),
    none: m.meta_list_status_none(),
  };
}

export const MEDAL_RANKS = 3;

export function metaEventTierLabels(): Record<MetaEventTier, string> {
  return {
    premier: m.meta_event_tier_premier(),
    competitive: m.meta_event_tier_competitive(),
    local: m.meta_event_tier_local(),
  };
}

export function metaEventStatusLabels(): Record<MetaEventStatus, string> {
  return {
    upcoming: m.meta_event_status_upcoming(),
    in_progress: m.meta_event_status_in_progress(),
    complete: m.meta_event_status_complete(),
  };
}

/** Grouping is pinned to `en-US`: SSR would otherwise send a different locale's separator than the browser renders. */
export function metaShownLabel(
  shown: number,
  total: number,
  noun: { singular: string; plural: string },
): string {
  const label = total === 1 ? noun.singular : noun.plural;
  if (shown === total) {
    return m.meta_shown_all({ total: total.toLocaleString("en-US"), label });
  }
  return m.meta_shown_partial({
    shown: shown.toLocaleString("en-US"),
    total: total.toLocaleString("en-US"),
    label,
  });
}

/** Not `Intl.ListFormat`: this must render the same string for every reader regardless of locale. */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? "";
  }
  return m.meta_join_and({ names: names.slice(0, -1).join(", "), last: names.at(-1) ?? "" });
}

export interface LegendNameParts {
  champion: string;
  title: string | null;
}

/**
 * Assumes every Legend is champion-tagged: an untagged legend, or a printed
 * name with a natural comma, would misparse as champion plus title.
 */
export function splitLegendName(name: string): LegendNameParts {
  const at = name.indexOf(", ");
  if (at === -1) {
    return { champion: name, title: null };
  }
  return { champion: name.slice(0, at), title: name.slice(at + 2) };
}

/** Assumes no event runs 1000+ rounds, or wins would stop outweighing losses in the packed value. */
export function recordSortValue(wins: number | null, losses: number | null): number | null {
  if (wins === null) {
    return null;
  }
  return wins * 1000 - (losses ?? 0);
}

/**
 * Exempt: cut-tier fields (ranks repeat and skip by design) and events with
 * no standings yet (pending, not incomplete).
 */
export function standingsGaps(
  players: readonly { rank: number; rankIsTier: boolean }[],
  reported: number | null,
): number[] {
  if (players.length === 0 || players.some((player) => player.rankIsTier)) {
    return [];
  }
  const held = new Set(players.map((player) => player.rank));
  const last = Math.max(reported ?? 0, ...held);
  const gaps: number[] = [];
  for (let rank = 1; rank <= last; rank++) {
    if (!held.has(rank)) {
      gaps.push(rank);
    }
  }
  return gaps;
}

/** Runs past `limit` are counted, not named. */
export function formatRankRuns(ranks: readonly number[], limit = 6): string {
  const runs: string[] = [];
  let start: number | null = null;
  let end = 0;
  for (const rank of ranks) {
    if (start === null) {
      start = rank;
      end = rank;
      continue;
    }
    if (rank === end + 1) {
      end = rank;
      continue;
    }
    runs.push(start === end ? `${start}` : `${start}–${end}`);
    start = rank;
    end = rank;
  }
  if (start !== null) {
    runs.push(start === end ? `${start}` : `${start}–${end}`);
  }
  if (runs.length <= limit) {
    return runs.join(", ");
  }
  return `${runs.slice(0, limit).join(", ")} and ${runs.length - limit} more`;
}

export interface MetaCountedEvent {
  eventDate: string;
  status: MetaEventStatus;
  playerCount: number | null;
  playerRowCount: number;
  deckCount: number;
}

function emptyStatusFor(event: MetaCountedEvent, today: string): string {
  if (event.status === "in_progress") {
    return m.meta_event_status_in_progress();
  }
  if (event.status === "upcoming" || event.eventDate > today) {
    return m.meta_event_not_played();
  }
  return m.meta_event_no_results();
}

export function metaEventEmptyStatus(event: MetaCountedEvent, today = todayUtc()): string | null {
  if (event.playerRowCount > 0 || event.deckCount > 0) {
    return null;
  }
  return emptyStatusFor(event, today);
}

export function metaEventFieldSize(
  event: Pick<MetaCountedEvent, "playerCount" | "playerRowCount">,
): number | null {
  return event.playerCount ?? (event.playerRowCount === 0 ? null : event.playerRowCount);
}

export function metaEventCounts(event: MetaCountedEvent, today = todayUtc()): string[] {
  const size = metaEventFieldSize(event);
  const parts: string[] = [];
  if (size !== null) {
    const count = size.toLocaleString("en-US");
    parts.push(
      size === 1 ? m.meta_count_players_one({ count }) : m.meta_count_players_other({ count }),
    );
  }
  if (event.playerRowCount === 0) {
    parts.push(emptyStatusFor(event, today));
  } else {
    const count = String(event.deckCount);
    parts.push(
      event.deckCount === 1
        ? m.meta_count_decks_one({ count })
        : m.meta_count_decks_other({ count }),
    );
  }
  return parts;
}

const META_PLAYER_CLAIM_LABELS: Record<MetaPlayerOverlayField, string> = {
  playerName: "Name",
  rank: "Finish",
  rankIsTier: "Bracket",
  wins: "Wins",
  losses: "Losses",
  draws: "Draws",
  matchPoints: "Match points",
  opponentMatchWinPct: "OMW%",
  gameWinPct: "GW%",
  opponentGameWinPct: "OGW%",
  entryStatus: "Entry status",
  legendCardId: "Legend",
  championCardId: "Champion",
  cards: "Decklist",
  listStatus: "Decklist",
};

export interface MetaPlayerClaimChip {
  field: MetaPlayerOverlayField;
  label: string;
}

/** `cards` and `listStatus` always collapse into one chip; unknown fields are dropped, not printed raw. */
export function metaPlayerClaimChips(claimedFields: readonly string[]): MetaPlayerClaimChip[] {
  const fields = new Set<string>(claimedFields);
  if (fields.has("listStatus")) {
    fields.add("cards");
  }
  return META_PLAYER_OVERLAY_FIELDS.filter(
    (field) => field !== "listStatus" && fields.has(field),
  ).map((field) => ({ field, label: META_PLAYER_CLAIM_LABELS[field] }));
}
