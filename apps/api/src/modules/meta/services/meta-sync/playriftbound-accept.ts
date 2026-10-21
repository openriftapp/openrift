import { playriftboundEventUrl } from "@openrift/shared/playriftbound-links";

import { PLAYRIFTBOUND_PROVIDER } from "../../../../lib/meta-providers.js";
import { longitudeLocalDay } from "../../lib/meta-local-day.js";
import { isTeamFormat, playriftboundFormat } from "../../lib/playriftbound-catalog.js";
import type { PlayriftboundListRow } from "../../repositories/playriftbound-events.js";
import { promoteNewEvent } from "../meta-promote.js";
import { errorText } from "./deps.js";
import type { PlayriftboundSyncDeps } from "./playriftbound-deps.js";
import { clock } from "./playriftbound-deps.js";
import { sameStoreLiveEvent } from "./same-store-guard.js";

export interface PlayriftboundAcceptSummary {
  considered: number;
  accepted: number;
  held: number;
  failed: number;
  errors: string[];
}

const SWEEP_PAGE = 1000;
const MAX_SWEEP_ERRORS = 50;
const MAX_EVENT_NAME = 120;

function emptySummary(): PlayriftboundAcceptSummary {
  return { considered: 0, accepted: 0, held: 0, failed: 0, errors: [] };
}

export interface AcceptedPlayriftboundEvent {
  metaEventId: string;
  slug: string;
  created: boolean;
}

export async function acceptPlayriftboundEvent(
  deps: PlayriftboundSyncDeps,
  row: PlayriftboundListRow,
): Promise<AcceptedPlayriftboundEvent> {
  const promoted = await promoteNewEvent(deps.repos, PLAYRIFTBOUND_PROVIDER, row.tournamentId, {
    name: row.name.slice(0, MAX_EVENT_NAME),
    eventDate: longitudeLocalDay(row.startAt, row.organizerLongitude),
    format: playriftboundFormat(row.format),
    sourceUrl: playriftboundEventUrl(row.tournamentId),
  });
  await deps.repos.playriftboundEvents.setRecheck(row.tournamentId, {
    nextCheckAt: clock(deps),
    checkStage: 0,
    failingSince: null,
  });
  return promoted;
}

async function sweep(
  deps: PlayriftboundSyncDeps,
  threshold: number,
  tournamentIds: readonly string[],
): Promise<PlayriftboundAcceptSummary> {
  const summary = emptySummary();
  for (let index = 0; index < tournamentIds.length; index += SWEEP_PAGE) {
    const page = tournamentIds.slice(index, index + SWEEP_PAGE);
    const rows = await deps.repos.playriftboundEvents.unacceptedByKeys(page);
    summary.considered += rows.length;
    for (const row of rows) {
      // The archive has one row per player; a 2v2 field would show as individual results.
      if (
        isTeamFormat(row.playerFormat) ||
        row.registeredCount === null ||
        row.registeredCount < threshold
      ) {
        continue;
      }
      const twin = await sameStoreLiveEvent(deps.repos, PLAYRIFTBOUND_PROVIDER, {
        name: row.name,
        eventDate: longitudeLocalDay(row.startAt, row.organizerLongitude),
        organizer: row.organizerName,
      });
      if (twin !== undefined) {
        summary.held++;
        continue;
      }
      try {
        await acceptPlayriftboundEvent(deps, row);
        summary.accepted++;
      } catch (error) {
        summary.failed++;
        if (summary.errors.length < MAX_SWEEP_ERRORS) {
          summary.errors.push(errorText(error, `Auto-accept "${row.name}"`));
        }
      }
    }
  }
  return summary;
}

/** Already-accepted or dismissed rows never reach here. */
export async function autoAcceptPlayriftboundEvents(
  deps: PlayriftboundSyncDeps,
  tournamentIds: readonly string[],
): Promise<PlayriftboundAcceptSummary> {
  if (tournamentIds.length === 0) {
    return emptySummary();
  }
  const settings = await deps.repos.uvsgamesEvents.settings();
  const threshold = settings.autoAcceptMinPlayers;
  if (threshold === null) {
    return emptySummary();
  }
  return await sweep(deps, threshold, tournamentIds);
}

/**
 * Runs the threshold over every row still awaiting triage, not just what a
 * crawl just wrote, so a threshold lowered today reaches events already listed.
 */
export async function autoAcceptPlayriftboundBacklog(
  deps: PlayriftboundSyncDeps,
): Promise<PlayriftboundAcceptSummary> {
  const settings = await deps.repos.uvsgamesEvents.settings();
  const threshold = settings.autoAcceptMinPlayers;
  if (threshold === null) {
    return emptySummary();
  }
  return await sweep(deps, threshold, await deps.repos.playriftboundEvents.newKeys());
}
