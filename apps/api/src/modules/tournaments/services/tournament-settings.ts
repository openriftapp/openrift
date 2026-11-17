import type { updateTournamentSchema } from "@openrift/shared/contracts/tournaments";
import { PLAYRIFTBOUND_EXTERNAL_ID_PREFIX } from "@openrift/shared/playriftbound-sync";
import type { z } from "zod";

import type { Repos } from "../../../deps.js";
import { conflict } from "../../../errors.js";
import { requireHost, resolveOrgHost } from "../lib/tournament-access.js";
import type { TournamentHostColumns } from "../lib/tournament-access.js";
import {
  assertDateOrder,
  assertGroupCutCompatible,
  assertPlayModeCompatible,
  assertStatusTransition,
} from "../lib/tournament-invariants.js";
import type { Tournament } from "../repositories/tournaments-shared.js";

/** Call inside a transaction that holds the rounds lock, with `tournament` read under it. */
export async function applySettingsPatch(
  repos: Repos,
  tournament: Tournament,
  patch: Omit<z.infer<typeof updateTournamentSchema>, "id">,
  userId: string,
): Promise<void> {
  const id = tournament.id;
  const currentStatus = tournament.status;
  if (currentStatus === "cancelled") {
    throw conflict("A cancelled tournament cannot be edited");
  }
  // Status moves follow the forward-only lifecycle; an unchanged value is a no-op.
  assertStatusTransition(currentStatus, patch.status);
  // Rounds/pods depend on the pairing engine, so it can change only before any round exists.
  const pairingChanging =
    patch.pairingStyle !== undefined && patch.pairingStyle !== tournament.pairingStyle;
  // The match format and play mode shape result entry, so they freeze with
  // the pairing engine once rounds exist.
  const matchFormatChanging =
    patch.matchFormat !== undefined && patch.matchFormat !== tournament.matchFormat;
  const playModeChanging = patch.playMode !== undefined && patch.playMode !== tournament.playMode;
  const formatChanging =
    (patch.format !== undefined && patch.format !== tournament.format) ||
    (patch.cutSize !== undefined && patch.cutSize !== tournament.cutSize) ||
    (patch.cutRematchAvoidance !== undefined &&
      patch.cutRematchAvoidance !== tournament.hasCutRematchAvoidance) ||
    (patch.legendTiebreak !== undefined && patch.legendTiebreak !== tournament.hasLegendTiebreak) ||
    (patch.groupsSelfPaced !== undefined &&
      patch.groupsSelfPaced !== tournament.hasSelfPacedGroups);
  if (
    (pairingChanging || matchFormatChanging || playModeChanging || formatChanging) &&
    (await repos.tournaments.hasRounds(tournament.id))
  ) {
    throw conflict("The pairing engine can't change once a round has been generated");
  }
  assertPlayModeCompatible(
    patch.playMode ?? tournament.playMode,
    patch.pairingStyle ?? tournament.pairingStyle,
    patch.regionsEnabled ?? tournament.hasRegions,
  );
  assertGroupCutCompatible(
    patch.format ?? tournament.format,
    patch.pairingStyle ?? tournament.pairingStyle,
    patch.playMode ?? tournament.playMode,
  );
  // Validate the merged schedule: a patch may touch only one of the three
  // instants, so the order check needs the existing row to fill the rest.
  assertDateOrder(
    patch.startsAt === undefined ? tournament.startsAt : new Date(patch.startsAt),
    patch.endsAt === undefined ? tournament.endsAt : patch.endsAt ? new Date(patch.endsAt) : null,
    patch.submissionsCloseAt === undefined
      ? tournament.submissionsCloseAt
      : patch.submissionsCloseAt
        ? new Date(patch.submissionsCloseAt)
        : null,
  );
  const relinking =
    patch.playriftboundEventId !== undefined &&
    tournament.playriftboundEventId !== null &&
    patch.playriftboundEventId !== tournament.playriftboundEventId;
  const synced = relinking
    ? await repos.tournaments.listParticipantsByExternalPrefix(id, PLAYRIFTBOUND_EXTERNAL_ID_PREFIX)
    : [];
  if (synced.length > 0) {
    throw conflict(
      "Players synced from the linked playriftbound event are in this tournament, so the link cannot change.",
    );
  }
  // Host reassignment is host-only; the target binds to the caller (personal = themselves).
  let hostPatch: Partial<TournamentHostColumns> = {};
  const hostChanging =
    patch.host !== undefined &&
    (patch.host.type !== tournament.hostType ||
      (patch.host.type === "organization" && patch.host.orgId !== tournament.hostOrgId));
  if (hostChanging && patch.host) {
    await requireHost(repos, tournament, userId);
    hostPatch =
      patch.host.type === "user"
        ? { hostType: "user", hostUserId: userId, hostOrgId: null }
        : await resolveOrgHost(repos, patch.host.orgId, userId);
  }
  await repos.tournaments.updateSettings(id, {
    ...hostPatch,
    name: patch.name,
    status: patch.status,
    pairingStyle: pairingChanging ? patch.pairingStyle : undefined,
    playMode: playModeChanging ? patch.playMode : undefined,
    startsAt: patch.startsAt === undefined ? undefined : new Date(patch.startsAt),
    endsAt: patch.endsAt === undefined ? undefined : patch.endsAt ? new Date(patch.endsAt) : null,
    groupId: patch.groupId,
    isPublished: patch.published,
    scoringScheme: patch.scoringScheme,
    byePoints: patch.byePoints,
    matchFormat: matchFormatChanging ? patch.matchFormat : undefined,
    winPoints: patch.winPoints,
    drawPoints: patch.drawPoints,
    hasRegions: patch.regionsEnabled,
    format: patch.format,
    cutSize: patch.cutSize,
    hasCutRematchAvoidance: patch.cutRematchAvoidance,
    hasLegendTiebreak: patch.legendTiebreak,
    hasSelfPacedGroups: patch.groupsSelfPaced,
    deckSubmission: patch.deckSubmission,
    submissionsCloseAt:
      patch.submissionsCloseAt === undefined
        ? undefined
        : patch.submissionsCloseAt
          ? new Date(patch.submissionsCloseAt)
          : null,
    listLockMode: patch.listLockMode,
    deckFormat: patch.deckFormat,
    allowedSets: patch.allowedSets,
    hasSelfRegistration: patch.selfRegistration,
    uvsgamesEventId: patch.uvsgamesEventId,
    playriftboundEventId: patch.playriftboundEventId,
  });
  // The rounds guard above means these teams never played.
  if (playModeChanging && patch.playMode === "1v1") {
    await repos.podTournaments.dissolveAllTeams(id);
  }
  // Leaving the pod engine revokes the follow-along report token.
  if (pairingChanging && patch.pairingStyle !== "pod" && patch.pairingStyle !== "swiss") {
    if (tournament.reportToken) {
      await repos.tournaments.setReportToken(id, null);
    }
    if (tournament.followToken) {
      await repos.tournaments.setFollowToken(id, null);
    }
  }
}
