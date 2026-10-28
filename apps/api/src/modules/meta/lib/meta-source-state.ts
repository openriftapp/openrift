import type { AdminMetaSourceState } from "@openrift/shared/contracts/admin/meta";
import { mirrorResultsState } from "@openrift/shared/meta-results";

import {
  PLAYLOLTCG_STATUS_FINISHED,
  UVSGAMES_STATUS_CANCELED,
} from "../../../lib/meta-providers.js";
import type { PlayloltcgListRow } from "../repositories/playloltcg-events.js";
import type { PlayriftboundListRow } from "../repositories/playriftbound-events.js";
import type { TopdeckListRow } from "../repositories/topdeck-events.js";
import type { UvsgamesListRow } from "../repositories/uvsgames-events.js";

function iso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

const NO_ROUNDS = { roundsPlayed: null, roundCount: null };

export function uvsgamesSourceState(row: UvsgamesListRow, now: Date): AdminMetaSourceState {
  return {
    provider: "uvsgames",
    externalId: row.externalId,
    status: row.displayStatus,
    cancelled: row.displayStatus === UVSGAMES_STATUS_CANCELED,
    missingSince: iso(row.missingSince),
    ...NO_ROUNDS,
    results: mirrorResultsState({
      started: row.startAt.getTime() <= now.getTime(),
      hasResults: row.displayStatus === "complete",
      nextCheckAt: row.nextCheckAt,
    }),
    nextCheckAt: iso(row.nextCheckAt),
    collects: true,
  };
}

/** `start_at` is a calendar day here, compared as the bucket SQL does against today. */
export function playloltcgSourceState(row: PlayloltcgListRow, now: Date): AdminMetaSourceState {
  return {
    provider: "playloltcg",
    externalId: String(row.activityShopId),
    status: row.status === null ? null : String(row.status),
    cancelled: false,
    missingSince: iso(row.missingSince),
    ...NO_ROUNDS,
    results: mirrorResultsState({
      started: row.startAt !== null && row.startAt <= now.toISOString().slice(0, 10),
      hasResults: row.status === PLAYLOLTCG_STATUS_FINISHED,
      nextCheckAt: row.nextCheckAt,
    }),
    nextCheckAt: iso(row.nextCheckAt),
    collects: true,
  };
}

export function topdeckSourceState(row: TopdeckListRow, now: Date): AdminMetaSourceState {
  return {
    provider: "topdeck",
    externalId: row.tid,
    status: null,
    cancelled: false,
    missingSince: iso(row.missingSince),
    ...NO_ROUNDS,
    results: mirrorResultsState({
      started: row.startAt.getTime() <= now.getTime(),
      hasResults: (row.playerCount ?? 0) > 0,
      nextCheckAt: null,
    }),
    nextCheckAt: null,
    collects: false,
  };
}

export function playriftboundSourceState(
  row: PlayriftboundListRow,
  now: Date,
): AdminMetaSourceState {
  return {
    provider: "playriftbound",
    externalId: row.tournamentId,
    status: null,
    cancelled: false,
    missingSince: iso(row.missingSince),
    roundsPlayed: row.roundsPlayed,
    roundCount: row.roundCount,
    results: mirrorResultsState({
      started: row.startAt.getTime() <= now.getTime(),
      hasResults: (row.roundsPlayed ?? 0) > 0,
      nextCheckAt: row.nextCheckAt,
    }),
    nextCheckAt: iso(row.nextCheckAt),
    collects: true,
  };
}
