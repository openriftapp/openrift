import type { MetaEventTier } from "@openrift/shared/types/enums";

import type { Repos } from "../../../deps.js";
import {
  PLAYLOLTCG_PROVIDER,
  PLAYRIFTBOUND_PROVIDER,
  UVSGAMES_PROVIDER,
} from "../../../lib/meta-providers.js";
import { classifyMetaEventTier } from "../lib/meta-event-classify.js";
import { mapSourceFormat } from "../lib/uvsgames-catalog.js";
import type { MetaEventSourceRow } from "../repositories/meta-sources.js";
import { countOrNull } from "./meta-promote-sources.js";
import type { MetaRepromoteResult } from "./meta-repromote.js";
import { promoteEach } from "./meta-repromote.js";

/**
 * Applies a changed tier rule to the events it actually moves.
 *
 * Classifies the whole archive from bulk reads and promotes only the events
 * that disagree with the live rows. An event an accepted overlay claims
 * `tier` on is skipped: the overlay wins whatever the rule says.
 */

export interface MetaRetierResult extends MetaRepromoteResult {
  scanned: number;
  moved: number;
}

export async function retierMetaEvents(repos: Repos): Promise<MetaRetierResult> {
  const [
    events,
    sources,
    uvsInputs,
    playloltcgInputs,
    playriftboundInputs,
    formatMappings,
    templateTiers,
    settings,
    claimed,
  ] = await Promise.all([
    repos.meta.allEventTiers(),
    repos.meta.allSources(),
    repos.uvsgamesEvents.tierInputsForLiveEvents(),
    repos.playloltcgEvents.tierInputsForLiveEvents(),
    repos.playriftboundEvents.tierInputsForLiveEvents(),
    repos.uvsgamesEvents.formatMappings(),
    repos.uvsgamesEvents.templateTiers(),
    repos.uvsgamesEvents.settings(),
    repos.metaOverlays.eventIdsClaimingField("tier"),
  ]);
  const floor = settings.competitivePlayerFloor;

  const uvsByKey = new Map(uvsInputs.map((row) => [row.externalId, row]));
  const playloltcgByKey = new Map(playloltcgInputs.map((row) => [String(row.activityShopId), row]));
  const playriftboundByKey = new Map(playriftboundInputs.map((row) => [row.tournamentId, row]));
  const sizeTier = (playerCount: number | null) =>
    classifyMetaEventTier({ templateTier: null, playerCount: countOrNull(playerCount) }, floor);
  const claimsTier = new Set(claimed);
  const sourcesByEvent = Map.groupBy(sources, (source) => source.metaEventId);

  const movers: string[] = [];
  for (const event of events) {
    if (claimsTier.has(event.id)) {
      continue;
    }
    const expected = expectedTier(sourcesByEvent.get(event.id) ?? [], event.tier, {
      [UVSGAMES_PROVIDER]: (externalId) => {
        const row = uvsByKey.get(externalId);
        if (row === undefined || mapSourceFormat(formatMappings, row.eventFormat) === null) {
          return null;
        }
        return classifyMetaEventTier(
          {
            templateTier:
              row.eventConfigurationTemplate === null
                ? null
                : (templateTiers.get(row.eventConfigurationTemplate) ?? null),
            playerCount: countOrNull(row.playerCount),
          },
          floor,
        );
      },
      [PLAYLOLTCG_PROVIDER]: (externalId) => {
        const row = playloltcgByKey.get(externalId);
        return row === undefined ? null : sizeTier(row.playerCount);
      },
      [PLAYRIFTBOUND_PROVIDER]: (externalId) => {
        const row = playriftboundByKey.get(externalId);
        return row === undefined ? null : sizeTier(row.playerCount);
      },
    });
    if (expected !== event.tier) {
      movers.push(event.id);
    }
  }

  const promoted = await promoteEach(repos, movers);
  return { ...promoted, scanned: events.length, moved: movers.length };
}

/** Returns the tier the citations would promote, in priority order, or the live tier if none speak. */
function expectedTier(
  sources: readonly MetaEventSourceRow[],
  live: MetaEventTier,
  tierBy: Record<string, (externalId: string) => MetaEventTier | null>,
): MetaEventTier {
  const ordered = sources
    .filter((source) => source.provider !== null && source.externalId !== null)
    .toSorted((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime());

  let tier = live;
  for (const source of ordered) {
    const externalId = source.externalId as string;
    const contributed = tierBy[source.provider as string]?.(externalId) ?? null;
    if (contributed !== null) {
      tier = contributed;
    }
  }
  return tier;
}

export function isRetierNoop(result: MetaRetierResult): boolean {
  return result.moved === 0;
}
