import { chunk } from "@openrift/shared/collections";
import { formatDay } from "@openrift/shared/format-date";
import { errorMessage } from "@openrift/shared/strings";
import { WellKnown } from "@openrift/shared/well-known";

import { recordCapped } from "../../../../lib/json-coerce.js";
import { PLAYLOLTCG_PROVIDER } from "../../../../lib/meta-providers.js";
import { META_NAME_MAX } from "../../lib/meta-event-naming.js";
import { playloltcgEventUrl } from "../../lib/playloltcg-catalog.js";
import type { PlayloltcgListRow } from "../../repositories/playloltcg-events.js";
import { promoteNewEvent } from "../meta-promote.js";
import { clock } from "./deps.js";
import type { PlayloltcgSyncDeps } from "./playloltcg-deps.js";
import { sameStoreLiveEvent } from "./same-store-guard.js";

/** This source has no template or notable-name signal; `activityType` doesn't distinguish events, so player count is the only accept rule. */
export interface PlayloltcgAcceptSummary {
  considered: number;
  accepted: number;
  held: number;
  failed: number;
  errors: string[];
}

const SWEEP_PAGE = 1000;

function emptySummary(): PlayloltcgAcceptSummary {
  return { considered: 0, accepted: 0, held: 0, failed: 0, errors: [] };
}

export interface AcceptedPlayloltcgEvent {
  metaEventId: string;
  slug: string;
  created: boolean;
}

function eventDate(row: PlayloltcgListRow, now: Date): string {
  return row.startAt ?? formatDay(now);
}

export async function acceptPlayloltcgEvent(
  deps: PlayloltcgSyncDeps,
  row: PlayloltcgListRow,
): Promise<AcceptedPlayloltcgEvent> {
  const promoted = await promoteNewEvent(
    deps.repos,
    PLAYLOLTCG_PROVIDER,
    String(row.activityShopId),
    {
      name: row.name.slice(0, META_NAME_MAX),
      eventDate: eventDate(row, clock(deps)),
      // This source carries no other format.
      format: WellKnown.deckFormat.CONSTRUCTED,
      sourceUrl: playloltcgEventUrl(row.activityShopId),
    },
  );
  await deps.repos.playloltcgEvents.setRecheck(row.activityShopId, {
    nextCheckAt: clock(deps),
    checkStage: 0,
  });
  return promoted;
}

async function sweep(
  deps: PlayloltcgSyncDeps,
  threshold: number,
  activityShopIds: readonly number[],
): Promise<PlayloltcgAcceptSummary> {
  const summary = emptySummary();
  for (const page of chunk(activityShopIds, SWEEP_PAGE)) {
    const rows = await deps.repos.playloltcgEvents.unacceptedByKeys(page);
    summary.considered += rows.length;
    for (const row of rows) {
      if (row.playerCount === null || row.playerCount < threshold) {
        continue;
      }
      const twin = await sameStoreLiveEvent(deps.repos, PLAYLOLTCG_PROVIDER, {
        name: row.name,
        eventDate: eventDate(row, clock(deps)),
        organizer: row.shopName,
      });
      if (twin !== undefined) {
        summary.held++;
        continue;
      }
      try {
        await acceptPlayloltcgEvent(deps, row);
        summary.accepted++;
      } catch (error) {
        summary.failed++;
        recordCapped(summary.errors, [`Auto-accept "${row.name}": ${errorMessage(error)}`]);
      }
    }
  }
  return summary;
}

/** Already-accepted or dismissed rows never reach here. */
export async function autoAcceptPlayloltcgEvents(
  deps: PlayloltcgSyncDeps,
  activityShopIds: readonly number[],
): Promise<PlayloltcgAcceptSummary> {
  if (activityShopIds.length === 0) {
    return emptySummary();
  }
  const settings = await deps.repos.uvsgamesEvents.settings();
  const threshold = settings.autoAcceptMinPlayers;
  if (threshold === null) {
    return emptySummary();
  }
  return await sweep(deps, threshold, activityShopIds);
}

/**
 * Runs the threshold over every row still awaiting triage, not just what a
 * crawl just wrote, so a threshold lowered today reaches events already listed.
 */
export async function autoAcceptPlayloltcgBacklog(
  deps: PlayloltcgSyncDeps,
): Promise<PlayloltcgAcceptSummary> {
  const settings = await deps.repos.uvsgamesEvents.settings();
  const threshold = settings.autoAcceptMinPlayers;
  if (threshold === null) {
    return emptySummary();
  }
  return await sweep(deps, threshold, await deps.repos.playloltcgEvents.newKeys());
}
