import { createLogger } from "@openrift/shared/logger";
import { errorMessage } from "@openrift/shared/strings";
import { effectiveTournamentState } from "@openrift/shared/tournament-lifecycle";

import type { Repos, Transact } from "../../../deps.js";
import type { Tournament, TournamentParticipant } from "../repositories/tournaments-shared.js";
import { reportGroupStageWalkovers } from "./group-cut.js";

const log = createLogger("tournament-drops");

async function findActiveTeammate(
  repos: Repos,
  tournamentId: string,
  participant: TournamentParticipant,
): Promise<TournamentParticipant | undefined> {
  if (participant.teamId === null) {
    return undefined;
  }
  const participants = await repos.tournaments.listParticipants(tournamentId);
  return participants.find(
    (row) =>
      row.teamId === participant.teamId && row.id !== participant.id && row.status === "active",
  );
}

/** Call inside a transaction: the drop and its walkovers commit together under the rounds lock. */
export async function dropParticipant(
  repos: Repos,
  tournamentId: string,
  participantId: string,
): Promise<void> {
  await repos.tournaments.lockRounds(tournamentId);
  const tournament = await repos.tournaments.getById(tournamentId);
  await repos.tournaments.lockParticipant(participantId);
  const participant = await repos.tournaments.getParticipantById(participantId);
  if (tournament === undefined || participant === undefined) {
    return;
  }
  await repos.tournaments.updateParticipant(participant.id, {
    status: "dropped",
    droppedAfterRound: tournament.currentRound,
  });
  // Dropping half a fixed team drops the whole team: 2v2 has no
  // substitutes and a lone partner can never be paired.
  if (tournament.playMode === "2v2" && participant.teamId !== null) {
    const teammate = await findActiveTeammate(repos, tournament.id, participant);
    if (teammate) {
      await repos.tournaments.updateParticipant(teammate.id, {
        status: "dropped",
        droppedAfterRound: tournament.currentRound,
      });
    }
  }
  await reportGroupStageWalkovers(repos, tournament, participant.id);
}

/** A pending spot leaves no trace: a denied request is deleted, and so is a withdrawn one. */
export async function withdrawPendingSpot(repos: Repos, participantId: string): Promise<void> {
  await repos.tournaments.deleteParticipant(participantId);
}

function isLive(tournament: Tournament, now: Date): boolean {
  const state = effectiveTournamentState(
    tournament.startsAt.toISOString(),
    tournament.endsAt?.toISOString() ?? null,
    tournament.status,
    now,
  );
  return state !== "completed" && state !== "cancelled";
}

async function dropLiveSpot(
  repos: Repos,
  transact: Transact,
  spot: TournamentParticipant,
  now: Date,
): Promise<void> {
  const tournament = await repos.tournaments.getById(spot.tournamentId);
  if (tournament === undefined || !isLive(tournament, now)) {
    return;
  }
  if (spot.status === "requested" || spot.status === "invited") {
    await transact(async (trxRepos) => {
      await trxRepos.tournaments.lockParticipant(spot.id);
      const locked = await trxRepos.tournaments.getParticipantById(spot.id);
      if (locked?.status === "requested" || locked?.status === "invited") {
        await withdrawPendingSpot(trxRepos, spot.id);
      }
    });
  } else if (spot.status === "active") {
    await transact(async (trxRepos) => {
      await trxRepos.tournaments.lockRounds(tournament.id);
      await trxRepos.tournaments.lockParticipant(spot.id);
      const locked = await trxRepos.tournaments.getParticipantById(spot.id);
      if (locked?.status === "active") {
        await dropParticipant(trxRepos, tournament.id, spot.id);
      }
    });
  }
}

/**
 * Runs before the account row is deleted and never throws: a spot that fails is
 * logged and left, so it cannot block the deletion. Spots in past events stay as they are.
 */
export async function dropLiveSpotsOfUser(
  repos: Repos,
  transact: Transact,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  let spots: TournamentParticipant[] = [];
  try {
    spots = await repos.tournaments.listParticipantsOfUser(userId);
  } catch (error) {
    log.error({ userId, error: errorMessage(error) }, "Could not list tournament spots");
  }
  for (const spot of spots) {
    try {
      await dropLiveSpot(repos, transact, spot, now);
    } catch (error) {
      log.error(
        { userId, participantId: spot.id, error: errorMessage(error) },
        "Could not drop a tournament spot",
      );
    }
  }
}
