import type { Repos } from "../../../deps.js";
import { UVSGAMES_PROVIDER } from "../../../lib/meta-providers.js";
import type {
  MetaEventMatchRow,
  MetaEventPhaseRow,
  NewMetaEventMatch,
  NewMetaEventPhase,
} from "../repositories/meta-events.js";
import { splitSourcePlayerKey } from "./ingest-meta-overlays.js";
import type { MetaPromoteResult } from "./meta-promote-shared.js";

interface EventStructure {
  phases: NewMetaEventPhase[];
  matches: NewMetaEventMatch[];
}

/** A match promotes only once both participants resolve to a live row. The uvsgames
 * mirror wins where it has data; an upload's own bracket fills the gap otherwise. */
export async function promotePhasesAndMatches(
  repos: Repos,
  metaEventId: string,
  sources: readonly { provider: string | null; externalId: string | null }[],
  result: MetaPromoteResult,
): Promise<void> {
  const mirror = await mirrorStructure(repos, metaEventId, sources);
  const structure =
    mirror !== null && (mirror.phases.length > 0 || mirror.matches.length > 0)
      ? mirror
      : await overlayStructure(repos, metaEventId);
  if (structure === null) {
    return;
  }

  if (structure.phases.length > 0) {
    if (!samePhases(await repos.meta.phasesForEvent(metaEventId), structure.phases)) {
      await repos.meta.replaceEventPhases(metaEventId, structure.phases);
    }
    result.phases = structure.phases.length;
  }

  if (structure.matches.length === 0) {
    return;
  }
  result.matches = structure.matches.length;
  const changed = changedMatches(await repos.meta.matchesForEvent(metaEventId), structure.matches);
  if (changed.length > 0) {
    await repos.meta.upsertEventMatches(changed);
  }
}

async function mirrorStructure(
  repos: Repos,
  metaEventId: string,
  sources: readonly { provider: string | null; externalId: string | null }[],
): Promise<EventStructure | null> {
  const uvs = sources.find((source) => source.provider === UVSGAMES_PROVIDER);
  if (uvs === undefined || uvs.externalId === null) {
    return null;
  }

  const sourcePhases = await repos.uvsgamesResults.phases(uvs.externalId);
  const phases = sourcePhases.map((phase) => ({
    metaEventId,
    phaseOrder: phase.phaseOrder,
    name: phase.name,
    roundType: phase.roundType,
    roundCount: phase.roundCount,
    rankRequired: phase.rankRequired,
    maxGameWins: phase.maxGameWins,
  }));

  const sourceMatches = await repos.uvsgamesResults.matches(uvs.externalId);
  if (sourceMatches.length === 0) {
    return { phases, matches: [] };
  }
  const players = await repos.meta.rawStandingsForEvent(metaEventId);
  const liveByUvsId = new Map(
    players
      .filter((player) => player.uvsgamesPlayerId !== null)
      .map((player) => [player.uvsgamesPlayerId as number, player.id]),
  );

  const matches: NewMetaEventMatch[] = [];
  for (const match of sourceMatches) {
    const player1Id = liveByUvsId.get(match.player1UvsgamesId);
    const player2Id =
      match.player2UvsgamesId === null ? null : liveByUvsId.get(match.player2UvsgamesId);
    if (player1Id === undefined || (match.player2UvsgamesId !== null && player2Id === undefined)) {
      continue;
    }
    matches.push({
      metaEventId,
      phaseOrder: match.phaseOrder,
      roundNumber: match.roundNumber,
      tableNumber: match.tableNumber,
      isBye: match.isBye,
      isDraw: match.isDraw,
      player1Id,
      player2Id: player2Id ?? null,
      winnerId:
        match.winnerUvsgamesId === null ? null : (liveByUvsId.get(match.winnerUvsgamesId) ?? null),
      gamesWonP1: match.gamesWonP1,
      gamesWonP2: match.gamesWonP2,
      sourceRoundId: match.roundId,
      sourceMatchId: match.sourceMatchId,
    });
  }
  return { phases, matches };
}

/** The newest accepted overlay carrying a bracket wins; its matches resolve
 * players through that same provider's player overlays. */
async function overlayStructure(repos: Repos, metaEventId: string): Promise<EventStructure | null> {
  const accepted = await repos.metaOverlays.acceptedEventOverlays(metaEventId);
  const overlays = accepted.filter(
    (overlay) => overlay.provider !== null && overlay.externalId !== null,
  );
  if (overlays.length === 0) {
    return null;
  }

  const structures = await repos.metaOverlays.structureByOverlayIds(
    overlays.map((overlay) => overlay.id),
  );
  const carrier = overlays.findLast((overlay) => {
    const structure = structures.get(overlay.id);
    return structure !== undefined && (structure.phases.length > 0 || structure.matches.length > 0);
  });
  const structure = carrier === undefined ? undefined : structures.get(carrier.id);
  if (carrier === undefined || structure === undefined) {
    return null;
  }

  const phases = structure.phases.map((phase) => ({
    metaEventId,
    phaseOrder: phase.phaseOrder,
    name: phase.name,
    roundType: phase.roundType,
    roundCount: phase.roundCount,
    rankRequired: phase.rankRequired,
    maxGameWins: phase.maxGameWins,
  }));

  if (structure.matches.length === 0) {
    return { phases, matches: [] };
  }

  const playerOverlays = await repos.metaOverlays.acceptedPlayerOverlays(metaEventId);
  const liveByExternalId = new Map<string, string>();
  for (const overlay of playerOverlays) {
    if (overlay.provider !== carrier.provider || overlay.metaEventPlayerId === null) {
      continue;
    }
    const key = splitSourcePlayerKey(overlay.sourcePlayerKey);
    if (key.eventExternalId === carrier.externalId && key.playerExternalId !== null) {
      liveByExternalId.set(key.playerExternalId, overlay.metaEventPlayerId);
    }
  }

  const matches: NewMetaEventMatch[] = [];
  for (const match of structure.matches) {
    const player1Id = liveByExternalId.get(match.player1ExternalId);
    const player2Id =
      match.player2ExternalId === null ? null : liveByExternalId.get(match.player2ExternalId);
    if (player1Id === undefined || (match.player2ExternalId !== null && player2Id === undefined)) {
      continue;
    }
    matches.push({
      metaEventId,
      phaseOrder: match.phaseOrder,
      roundNumber: match.roundNumber,
      tableNumber: match.tableNumber,
      isBye: match.isBye,
      isDraw: match.isDraw,
      player1Id,
      player2Id: player2Id ?? null,
      winnerId:
        match.winnerExternalId === null
          ? null
          : (liveByExternalId.get(match.winnerExternalId) ?? null),
      gamesWonP1: match.gamesWonP1,
      gamesWonP2: match.gamesWonP2,
      sourceRoundId: match.roundExternalId,
      sourceMatchId: match.externalId,
    });
  }
  return { phases, matches };
}

function samePhases(
  stored: readonly MetaEventPhaseRow[],
  next: readonly NewMetaEventPhase[],
): boolean {
  if (stored.length !== next.length) {
    return false;
  }
  return next.every((row, index) => {
    const was = stored[index];
    return (
      was !== undefined &&
      was.phaseOrder === row.phaseOrder &&
      was.name === row.name &&
      was.roundType === row.roundType &&
      was.roundCount === row.roundCount &&
      was.rankRequired === row.rankRequired &&
      was.maxGameWins === row.maxGameWins
    );
  });
}

/** The pairings whose stored row would actually move. */
function changedMatches(
  stored: readonly MetaEventMatchRow[],
  next: readonly NewMetaEventMatch[],
): NewMetaEventMatch[] {
  const byKey = new Map(
    stored.flatMap((row) =>
      row.sourceMatchId === null ? [] : [[row.sourceMatchId, row] as const],
    ),
  );
  return next.filter((row) => {
    // A row the source gave no id to cannot be matched up, so it is always
    // written and left to the seat index to converge.
    if (row.sourceMatchId === null || row.sourceMatchId === undefined) {
      return true;
    }
    const was = byKey.get(row.sourceMatchId);
    return (
      was === undefined ||
      was.phaseOrder !== row.phaseOrder ||
      was.roundNumber !== row.roundNumber ||
      was.sourceRoundId !== row.sourceRoundId ||
      was.tableNumber !== row.tableNumber ||
      was.isBye !== row.isBye ||
      was.isDraw !== row.isDraw ||
      was.player1Id !== row.player1Id ||
      was.player2Id !== row.player2Id ||
      was.winnerId !== row.winnerId ||
      was.gamesWonP1 !== row.gamesWonP1 ||
      was.gamesWonP2 !== row.gamesWonP2
    );
  });
}
