import { publicTournamentsContract } from "@openrift/shared/contracts/public-tournaments";
import type {
  PublicTournamentJoinResponse,
  PublicTournamentLandingResponse,
  TournamentStaffInviteLandingResponse,
} from "@openrift/shared/types/api/tournament";
import { implement } from "@orpc/server";

import type { Repos, Transact } from "../../../deps.js";
import { conflict, forbidden, notFound } from "../../../errors.js";
import { isUniqueViolationOn } from "../../../lib/pg-errors.js";
import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { withUniqueClaimToken } from "../lib/claim-token.js";
import type { Tournament } from "../repositories/tournaments-shared.js";

async function hostDisplayName(repos: Repos, tournament: Tournament): Promise<string> {
  if (tournament.hostType === "user") {
    if (!tournament.hostUserId) {
      return "Host";
    }
    const names = await repos.tournaments.getUserNames([tournament.hostUserId]);
    return names.get(tournament.hostUserId) || "Host";
  }
  const org = tournament.hostOrgId
    ? await repos.organizations.getById(tournament.hostOrgId)
    : undefined;
  return org?.name ?? "Organization";
}

/**
 * Falls back to the email's local part; the raw email must never appear
 * as a public participant name.
 */
export function participantDisplayName(name: string | null | undefined, email: string): string {
  const trimmed = name?.trim();
  if (trimmed) {
    return trimmed;
  }
  const localPart = email.split("@")[0]?.trim();
  return localPart || "Player";
}

function assertSelfJoinOpen(tournament: Tournament | undefined, token: string): Tournament {
  if (!tournament || tournament.submissionToken !== token) {
    throw notFound("Not found");
  }
  if (tournament.status === "completed" || tournament.status === "cancelled") {
    throw conflict("This tournament is no longer accepting entries");
  }
  if (!tournament.hasSelfRegistration) {
    throw forbidden("Self-registration is not open");
  }
  return tournament;
}

/**
 * The one-participant-per-account index rejects a concurrent double-submit's
 * insert; that case resolves to the winning row.
 */
export async function resolveSelfJoin(
  repos: Repos,
  transact: Transact,
  tournamentId: string,
  token: string,
  user: { id: string; name: string | null; email: string },
): Promise<PublicTournamentJoinResponse> {
  try {
    return await withUniqueClaimToken((claimToken) =>
      transact(async (trxRepos) => {
        await trxRepos.tournaments.lockRounds(tournamentId);
        assertSelfJoinOpen(await trxRepos.tournaments.getById(tournamentId), token);
        const existing = await trxRepos.tournaments.getParticipantByUser(tournamentId, user.id);
        if (existing) {
          return { participantId: existing.id, status: existing.status, alreadyJoined: true };
        }
        const created = await trxRepos.tournaments.createParticipant({
          tournamentId,
          userId: user.id,
          displayName: participantDisplayName(user.name, user.email),
          status: "requested",
          claimSource: "self_submit",
          claimToken,
          claimedAt: new Date(),
        });
        return { participantId: created.id, status: created.status, alreadyJoined: false };
      }),
    );
  } catch (error) {
    if (isUniqueViolationOn(error, "uq_tournament_participants_user")) {
      const raced = await repos.tournaments.getParticipantByUser(tournamentId, user.id);
      if (raced) {
        return { participantId: raced.id, status: raced.status, alreadyJoined: true };
      }
    }
    throw error;
  }
}

const os = implement(publicTournamentsContract).$context<ApiContext>().use(requireUser);

export const publicTournamentsRouter = {
  landing: os.landing.handler(
    async ({ input, context, errors }): Promise<PublicTournamentLandingResponse> => {
      const repos = context.repos;
      const tournament = await repos.tournaments.getBySubmissionToken(input.token);
      if (!tournament) {
        throw errors.NOT_FOUND({ message: "Not found" });
      }
      const viewer = await context.loadUser();
      const participant = viewer
        ? await repos.tournaments.getParticipantByUser(tournament.id, viewer.id)
        : undefined;
      return {
        name: tournament.name,
        hostDisplayName: await hostDisplayName(repos, tournament),
        selfRegistrationOpen: tournament.hasSelfRegistration,
        deckExpected: tournament.deckSubmission !== "none",
        viewerIsParticipant: participant !== undefined,
        viewerParticipantStatus: participant?.status ?? null,
      };
    },
  ),

  requestJoin: os.requestJoin.handler(
    async ({ input, context, errors }): Promise<PublicTournamentJoinResponse> => {
      const repos = context.repos;
      const user = context.user;
      if (!user) {
        throw errors.UNAUTHORIZED({ message: "Unauthorized" });
      }
      const tournament = assertSelfJoinOpen(
        await repos.tournaments.getBySubmissionToken(input.token),
        input.token,
      );
      return resolveSelfJoin(repos, context.transact, tournament.id, input.token, user);
    },
  ),

  staffInviteLanding: os.staffInviteLanding.handler(
    async ({ input, context, errors }): Promise<TournamentStaffInviteLandingResponse> => {
      const repos = context.repos;
      const match = await repos.tournaments.getByStaffInviteToken(input.token);
      if (!match) {
        throw errors.NOT_FOUND({ message: "Not found" });
      }
      const viewer = await context.loadUser();
      const alreadyStaff = viewer
        ? await repos.tournaments.isHostOrStaff(match.tournament.id, viewer.id, [match.role])
        : false;
      return {
        name: match.tournament.name,
        hostDisplayName: await hostDisplayName(repos, match.tournament),
        role: match.role,
        alreadyStaff,
      };
    },
  ),

  claimStaffInvite: os.claimStaffInvite.handler(async ({ input, context, errors }) => {
    const repos = context.repos;
    const user = context.user;
    if (!user) {
      throw errors.UNAUTHORIZED({ message: "Unauthorized" });
    }
    const match = await repos.tournaments.getByStaffInviteToken(input.token);
    if (!match) {
      throw errors.NOT_FOUND({ message: "Not found" });
    }
    const alreadyStaff = await repos.tournaments.isHostOrStaff(match.tournament.id, user.id, [
      match.role,
    ]);
    // Idempotent: addStaff no-ops on the (tournament, user, role) key, so a second
    // confirm (or a refresh) is harmless.
    await repos.tournaments.addStaff(match.tournament.id, user.id, match.role);
    return { tournamentId: match.tournament.id, role: match.role, alreadyStaff };
  }),
};
