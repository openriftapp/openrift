import { tournamentsContract } from "@openrift/shared/contracts/tournaments";
import { memberNameEnglish } from "@openrift/shared/member-name";
import { GROUP_STAGE_ROUNDS } from "@openrift/shared/pairing/group-cut-types";
import type { PodTournamentDetailResponse } from "@openrift/shared/types/api/pod-tournament";
import type {
  TournamentDetailResponse,
  TournamentListResponse,
  TournamentPageResponse,
  TournamentParticipantListResponse,
} from "@openrift/shared/types/api/tournament";
import { implement } from "@orpc/server";

import { badRequest, conflict, forbidden, notFound } from "../../../errors.js";
import { assertExisted } from "../../../lib/assertions.js";
import { buildKeysetCursor } from "../../../lib/keyset-cursor.js";
import { withUniqueShareToken } from "../../../lib/share-token.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { assertKnownFormat } from "../../decks/lib/deck-format-validation.js";
import { loadGroupForMember } from "../../groups/lib/group-access.js";
import { withUniqueClaimToken } from "../lib/claim-token.js";
import { isGroupCut } from "../lib/group-cut.js";
import {
  buildPodRunDetail,
  buildStandingsSnapshot,
  podRunDetailById,
} from "../lib/pod-tournament-builders.js";
import {
  assertIdentityEditable,
  loadParticipant,
  loadTournament,
  loadTournamentForWrite,
  requireHost,
  requireManage,
  requireStaff,
  resolveOrgHost,
} from "../lib/tournament-access.js";
import type { TournamentHostColumns } from "../lib/tournament-access.js";
import {
  buildDetail,
  buildParticipantList,
  buildStaffList,
  buildSummaries,
  detailById,
} from "../lib/tournament-builders.js";
import {
  assertDateOrder,
  assertGroupCutCompatible,
  assertLegendAssignable,
  assertParticipantsOpen,
  assertPlayModeCompatible,
  assertValidRegion,
} from "../lib/tournament-invariants.js";
import {
  assertCutRoundEditable,
  assertGroupCutRun,
  completeAfterFinal,
  generateGroupCutRound,
  rerollGroupCutRound,
  setLegendMetaShares,
  startGroupRound as startGroupRoundEngine,
  startGroupStageRound as startGroupStageRoundEngine,
  replaceCutRoundPairing,
  replaceGroupSeats,
} from "../services/group-cut.js";
import { dropParticipant, withdrawPendingSpot } from "../services/participant-drops.js";
import {
  clearPodResult,
  finalizeRound as finalizeRoundEngine,
  pairNextRound,
  replaceRoundPairing,
  rerollRound as rerollRoundEngine,
  submitPodResult,
} from "../services/pod-pairing.js";
import { applySettingsPatch } from "../services/tournament-settings.js";

const os = implement(tournamentsContract).$context<ApiContext>().use(requireAuthedUser);

const DEFAULT_PAST_PAGE_SIZE = 25;
const TEAMS_NEED_2V2 = "Teams exist only in 2v2 tournaments.";

// Handlers own request shape and ordering only; access, invariants, and
// response assembly live in tournament-access/-invariants/-builders.ts.
export const tournamentsRouter = {
  list: os.list.handler(async ({ input, context }): Promise<TournamentPageResponse> => {
    const repos = context.repos;
    const userId = context.userId;
    const limit = input.limit ?? DEFAULT_PAST_PAGE_SIZE;
    const cursor = input.cursor ?? null;
    const now = new Date();
    const [orgIds, judgeOrgIds] = await Promise.all([
      repos.organizations.listIdsForUser(userId),
      repos.organizations.listJudgeOrgIdsForUser(userId),
    ]);
    const hostOrgIds = [...orgIds, ...judgeOrgIds];
    const [current, past, pastCount] = await Promise.all([
      cursor === null
        ? repos.tournaments.listCurrentForUser(userId, hostOrgIds, now)
        : Promise.resolve([]),
      repos.tournaments.listPastForUser(userId, hostOrgIds, now, { cursor, limit }),
      repos.tournaments.countPastForUser(userId, hostOrgIds, now),
    ]);
    const pastPage = past.slice(0, limit);
    const last = pastPage.at(-1);
    const items = await buildSummaries(
      repos,
      [...current, ...pastPage],
      userId,
      new Set(orgIds),
      new Set(judgeOrgIds),
    );
    return {
      items,
      nextCursor: past.length > limit && last ? buildKeysetCursor(last.startsAt, last.id) : null,
      pastCount,
    };
  }),

  listForGroup: os.listForGroup.handler(
    async ({ input, context }): Promise<TournamentListResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      // Group members only: 404 (not 403) when the slug is unknown or the viewer
      // is not a member, so membership is not leaked.
      const ctx = await loadGroupForMember(repos, input.slug, userId);
      const [orgIds, judgeOrgIds] = await Promise.all([
        repos.organizations.listIdsForUser(userId),
        repos.organizations.listJudgeOrgIdsForUser(userId),
      ]);
      const rows = await repos.tournaments.listForGroupWithCounts(ctx.group.id);
      const items = await buildSummaries(
        repos,
        rows,
        userId,
        new Set(orgIds),
        new Set(judgeOrgIds),
      );
      return { items: items.filter((item) => item.published || item.myRoles.length > 0) };
    },
  ),

  create: os.create.handler(async ({ input, context }): Promise<TournamentDetailResponse> => {
    const repos = context.repos;
    const userId = context.userId;
    assertDateOrder(
      new Date(input.startsAt),
      input.endsAt ? new Date(input.endsAt) : null,
      input.submissionsCloseAt ? new Date(input.submissionsCloseAt) : null,
    );
    assertPlayModeCompatible(
      input.playMode ?? "1v1",
      input.pairingStyle,
      input.regionsEnabled ?? false,
    );
    assertGroupCutCompatible(input.format ?? "rounds", input.pairingStyle, input.playMode ?? "1v1");
    if (input.deckFormat !== undefined) {
      await assertKnownFormat(repos.deckFormats, input.deckFormat);
    }

    const host: TournamentHostColumns =
      input.host.type === "user"
        ? { hostType: "user", hostUserId: userId, hostOrgId: null }
        : await resolveOrgHost(repos, input.host.orgId, userId);

    if (input.groupId) {
      const membership = await repos.friendGroups.getMembership(input.groupId, userId);
      if (!membership) {
        throw forbidden("Not a member of that group");
      }
    }

    const created = await withUniqueShareToken(
      (submissionToken) =>
        context.transact(async (txRepos) => {
          const tournament = await txRepos.tournaments.create({
            ...host,
            groupId: input.groupId ?? null,
            isPublished: input.published,
            name: input.name,
            pairingStyle: input.pairingStyle,
            playMode: input.playMode,
            scoringScheme: input.scoringScheme,
            byePoints: input.byePoints,
            matchFormat: input.matchFormat,
            winPoints: input.winPoints,
            drawPoints: input.drawPoints,
            hasRegions: input.regionsEnabled,
            format: input.format,
            cutSize: input.cutSize,
            hasCutRematchAvoidance: input.cutRematchAvoidance,
            hasLegendTiebreak: input.legendTiebreak,
            hasSelfPacedGroups: input.groupsSelfPaced,
            deckSubmission: input.deckSubmission,
            submissionsCloseAt: input.submissionsCloseAt
              ? new Date(input.submissionsCloseAt)
              : null,
            listLockMode: input.listLockMode,
            deckFormat: input.deckFormat,
            allowedSets: input.allowedSets ?? null,
            hasSelfRegistration: input.selfRegistration,
            startsAt: new Date(input.startsAt),
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
          });
          await txRepos.tournaments.addStaff(tournament.id, userId, "organizer");
          if ((input.selfRegistration ?? false) || input.deckSubmission !== "none") {
            await txRepos.tournaments.setSubmissionToken(tournament.id, submissionToken);
          }
          return tournament;
        }),
      { constraint: "uq_tournaments_submission_token" },
    );
    return detailById(repos, created.id, userId);
  }),

  get: os.get.handler(async ({ input, context }): Promise<TournamentDetailResponse> => {
    const repos = context.repos;
    const userId = context.userId;
    const tournament = await loadTournament(repos, input.id);
    if (!(await repos.tournaments.hasRelationship(tournament.id, userId))) {
      throw notFound("Tournament not found");
    }
    return buildDetail(repos, tournament, userId);
  }),

  update: os.update.handler(async ({ input, context }): Promise<TournamentDetailResponse> => {
    const repos = context.repos;
    const userId = context.userId;
    const { id, ...patch } = input;
    await requireManage(repos, await loadTournament(repos, id), userId);
    if (patch.deckFormat !== undefined) {
      await assertKnownFormat(repos.deckFormats, patch.deckFormat);
    }
    if (patch.groupId) {
      const membership = await repos.friendGroups.getMembership(patch.groupId, userId);
      if (!membership) {
        throw forbidden("Not a member of that group");
      }
    }
    // Under the rounds lock, the round guard and the team dissolve see the
    // rounds as they are at the write, never a round generated in between.
    const tournament = await context.transact(async (trxRepos) => {
      const current = await loadTournamentForWrite(trxRepos, id);
      await applySettingsPatch(trxRepos, current, patch, userId);
      return current;
    });
    // Mint the share link the first time it's needed (self-registration opened
    // or decks now expected); turning self-registration off keeps the link.
    const willSelfRegister = patch.selfRegistration ?? tournament.hasSelfRegistration;
    const willExpectDecks = (patch.deckSubmission ?? tournament.deckSubmission) !== "none";
    if (!tournament.submissionToken && (willSelfRegister || willExpectDecks)) {
      await withUniqueShareToken(
        (token) =>
          context.transact(async (trxRepos) => {
            const current = await loadTournamentForWrite(trxRepos, id);
            if (
              !current.submissionToken &&
              (current.hasSelfRegistration || current.deckSubmission !== "none")
            ) {
              await trxRepos.tournaments.setSubmissionToken(id, token);
            }
          }),
        { constraint: "uq_tournaments_submission_token" },
      );
    }
    return detailById(repos, id, userId);
  }),

  cancel: os.cancel.handler(async ({ input, context }): Promise<TournamentDetailResponse> => {
    const repos = context.repos;
    const userId = context.userId;
    const tournament = await loadTournament(repos, input.id);
    await requireManage(repos, tournament, userId);
    // Locked so a round generated concurrently cannot write "running" over the cancellation.
    await context.transact(async (trxRepos) => {
      await trxRepos.tournaments.lockRounds(input.id);
      await trxRepos.tournaments.updateSettings(input.id, { status: "cancelled" });
    });
    return detailById(repos, input.id, userId);
  }),

  remove: os.remove.handler(async ({ input, context }): Promise<void> => {
    const repos = context.repos;
    const userId = context.userId;
    const tournament = await loadTournament(repos, input.id);
    await requireHost(repos, tournament, userId);
    const deleted = await repos.tournaments.deleteById(input.id);
    assertExisted(deleted, "Tournament not found");
  }),

  enableSubmissionToken: os.enableSubmissionToken.handler(
    async ({ input, context }): Promise<TournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await withUniqueShareToken(
        (token) =>
          context.transact(async (trxRepos) => {
            await loadTournamentForWrite(trxRepos, input.id);
            await trxRepos.tournaments.setSubmissionToken(input.id, token);
          }),
        { constraint: "uq_tournaments_submission_token" },
      );
      return detailById(repos, input.id, userId);
    },
  ),

  disableSubmissionToken: os.disableSubmissionToken.handler(
    async ({ input, context }): Promise<TournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await context.transact(async (trxRepos) => {
        await loadTournamentForWrite(trxRepos, input.id);
        await trxRepos.tournaments.setSubmissionToken(input.id, null);
      });
      return detailById(repos, input.id, userId);
    },
  ),

  listStaff: os.listStaff.handler(async ({ input, context }) => {
    const repos = context.repos;
    const userId = context.userId;
    const tournament = await loadTournament(repos, input.id);
    await requireManage(repos, tournament, userId);
    return buildStaffList(repos, tournament);
  }),

  listStaffCandidates: os.listStaffCandidates.handler(async ({ input, context }) => {
    const repos = context.repos;
    const userId = context.userId;
    const tournament = await loadTournament(repos, input.id);
    await requireManage(repos, tournament, userId);
    const items = await repos.tournaments.listStaffCandidates(tournament.id, tournament.groupId);
    return { items };
  }),

  addStaff: os.addStaff.handler(async ({ input, context }) => {
    const repos = context.repos;
    const userId = context.userId;
    const tournament = await loadTournament(repos, input.id);
    await requireManage(repos, tournament, userId);
    // Re-check eligibility server-side: only linked group members and
    // account-linked participants may be granted, so a forged id is rejected.
    const eligible = await repos.tournaments.isStaffCandidate(
      tournament.id,
      tournament.groupId,
      input.userId,
    );
    if (!eligible) {
      throw forbidden("Only group members or participants can be added as staff");
    }
    await repos.tournaments.addStaff(tournament.id, input.userId, input.role);
    return buildStaffList(repos, tournament);
  }),

  enableStaffInvite: os.enableStaffInvite.handler(
    async ({ input, context }): Promise<TournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await withUniqueShareToken(
        (token) => repos.tournaments.setStaffInviteToken(input.id, input.role, token),
        {
          constraint:
            input.role === "organizer"
              ? "uq_tournaments_organizer_invite_token"
              : "uq_tournaments_judge_invite_token",
        },
      );
      return detailById(repos, input.id, userId);
    },
  ),

  disableStaffInvite: os.disableStaffInvite.handler(
    async ({ input, context }): Promise<TournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await repos.tournaments.setStaffInviteToken(input.id, input.role, null);
      return detailById(repos, input.id, userId);
    },
  ),

  removeStaff: os.removeStaff.handler(async ({ input, context }) => {
    const repos = context.repos;
    const userId = context.userId;
    const tournament = await loadTournament(repos, input.id);
    await requireManage(repos, tournament, userId);
    await repos.tournaments.removeStaff(input.id, input.userId, input.role);
    return buildStaffList(repos, tournament);
  }),

  listParticipants: os.listParticipants.handler(
    async ({ input, context }): Promise<TournamentParticipantListResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      if (!(await repos.tournaments.hasRelationship(tournament.id, userId))) {
        throw notFound("Tournament not found");
      }
      const allowed = await repos.tournaments.isHostOrStaff(tournament.id, userId, [
        "organizer",
        "judge",
      ]);
      if (!allowed) {
        throw forbidden("Host or staff only");
      }
      return buildParticipantList(repos, input.id);
    },
  ),

  addParticipant: os.addParticipant.handler(
    async ({ input, context }): Promise<TournamentParticipantListResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireStaff(repos, tournament, userId);
      await assertValidRegion(repos, input.region);
      await withUniqueClaimToken((claimToken) =>
        context.transact(async (trxRepos) => {
          assertParticipantsOpen(await loadTournamentForWrite(trxRepos, input.id));
          await trxRepos.tournaments.createParticipant({
            tournamentId: input.id,
            displayName: input.displayName,
            region: input.region ?? null,
            fixedTable: input.fixedTable ?? null,
            claimToken,
            status: "active",
          });
        }),
      );
      return buildParticipantList(repos, input.id);
    },
  ),

  updateParticipant: os.updateParticipant.handler(
    async ({ input, context }): Promise<TournamentParticipantListResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      // Region assignment is judge work, so a region-only patch needs staff, not manage.
      const touchesManagedFields =
        input.displayName !== undefined ||
        input.seed !== undefined ||
        input.fixedTable !== undefined;
      await (touchesManagedFields
        ? requireManage(repos, tournament, userId)
        : requireStaff(repos, tournament, userId));
      await loadParticipant(repos, input.id, input.participantId);
      await assertValidRegion(repos, input.region);
      await context.transact(async (trxRepos) => {
        // The Legend and seed guards read the group stage, so they run under
        // the lock the group and cut writers hold.
        const current = await loadTournamentForWrite(trxRepos, input.id);
        await trxRepos.tournaments.lockParticipant(input.participantId);
        const participant = await loadParticipant(trxRepos, input.id, input.participantId);
        assertIdentityEditable(participant.displayName, input.displayName !== undefined);
        if (input.legendCardId !== undefined) {
          await assertLegendAssignable(trxRepos, current, input.legendCardId);
        }
        if (input.seed !== undefined && isGroupCut(current)) {
          const cutRound = await trxRepos.podTournaments.getRoundByNumber(
            current.id,
            GROUP_STAGE_ROUNDS + 1,
          );
          if (cutRound) {
            throw conflict("Seeds were locked when the cut was generated");
          }
        }
        await trxRepos.tournaments.updateParticipant(input.participantId, {
          displayName: input.displayName,
          seed: input.seed,
          region: input.region,
          legendCardId: input.legendCardId,
          fixedTable: input.fixedTable,
        });
      });
      return buildParticipantList(repos, input.id);
    },
  ),

  dropParticipant: os.dropParticipant.handler(
    async ({ input, context }): Promise<TournamentParticipantListResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await loadParticipant(repos, input.id, input.participantId);
      await context.transact((trxRepos) =>
        dropParticipant(trxRepos, input.id, input.participantId),
      );
      return buildParticipantList(repos, input.id);
    },
  ),

  reactivateParticipant: os.reactivateParticipant.handler(
    async ({ input, context }): Promise<TournamentParticipantListResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await loadParticipant(repos, input.id, input.participantId);
      await context.transact(async (trxRepos) => {
        const current = await loadTournamentForWrite(trxRepos, input.id);
        const participant = await loadParticipant(trxRepos, input.id, input.participantId);
        await trxRepos.tournaments.updateParticipant(input.participantId, {
          status: "active",
          droppedAfterRound: null,
        });
        // Team drops are symmetric (see dropParticipant), so a team returns
        // whole too: bring the dropped teammate back with them.
        if (current.playMode === "2v2" && participant.teamId !== null) {
          const participants = await trxRepos.tournaments.listParticipants(input.id);
          const teammate = participants.find(
            (row) =>
              row.teamId === participant.teamId &&
              row.id !== participant.id &&
              row.status === "dropped",
          );
          if (teammate) {
            await trxRepos.tournaments.updateParticipant(teammate.id, {
              status: "active",
              droppedAfterRound: null,
            });
          }
        }
      });
      return buildParticipantList(repos, input.id);
    },
  ),

  approveParticipant: os.approveParticipant.handler(
    async ({ input, context, errors }): Promise<TournamentParticipantListResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await context.transact(async (trxRepos) => {
        assertParticipantsOpen(await loadTournamentForWrite(trxRepos, input.id));
        await trxRepos.tournaments.lockParticipant(input.participantId);
        const participant = await loadParticipant(trxRepos, input.id, input.participantId);
        if (participant.status !== "requested") {
          throw errors.CONFLICT({ message: "Only a pending request can be approved" });
        }
        await trxRepos.tournaments.updateParticipant(input.participantId, { status: "active" });
      });
      return buildParticipantList(repos, input.id);
    },
  ),

  denyParticipant: os.denyParticipant.handler(
    async ({ input, context, errors }): Promise<TournamentParticipantListResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await context.transact(async (trxRepos) => {
        await trxRepos.tournaments.lockParticipant(input.participantId);
        const participant = await loadParticipant(trxRepos, input.id, input.participantId);
        if (participant.status !== "requested") {
          throw errors.CONFLICT({ message: "Only a pending request can be denied" });
        }
        await withdrawPendingSpot(trxRepos, input.participantId);
      });
      return buildParticipantList(repos, input.id);
    },
  ),

  removeParticipant: os.removeParticipant.handler(
    async ({ input, context, errors }): Promise<TournamentParticipantListResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await loadParticipant(repos, input.id, input.participantId);
      await context.transact(async (trxRepos) => {
        // Locked first: a concurrent pairing holds FOR KEY SHARE on this row
        // through its pod_members inserts, so the check below sees it.
        const exists = await trxRepos.tournaments.lockParticipant(input.participantId);
        if (!exists) {
          return;
        }
        if (await trxRepos.tournaments.participantHasMemberships(input.participantId)) {
          throw errors.CONFLICT({
            message:
              "This participant is in a paired round and cannot be removed. Drop them instead.",
          });
        }
        await trxRepos.tournaments.deleteParticipant(input.participantId);
      });
      return buildParticipantList(repos, input.id);
    },
  ),

  unlinkParticipant: os.unlinkParticipant.handler(
    async ({ input, context }): Promise<TournamentParticipantListResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await loadParticipant(repos, input.id, input.participantId);
      await repos.tournaments.updateParticipant(input.participantId, {
        userId: null,
        claimedAt: null,
        claimBlockedAt: new Date(),
      });
      return buildParticipantList(repos, input.id);
    },
  ),

  reissueClaim: os.reissueClaim.handler(
    async ({ input, context }): Promise<TournamentParticipantListResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await withUniqueClaimToken((claimToken) =>
        context.transact(async (trxRepos) => {
          await loadTournamentForWrite(trxRepos, input.id);
          await trxRepos.tournaments.lockParticipant(input.participantId);
          const participant = await loadParticipant(trxRepos, input.id, input.participantId);
          assertIdentityEditable(participant.displayName, true);
          await trxRepos.tournaments.reissueClaim(input.participantId, claimToken);
        }),
      );
      return buildParticipantList(repos, input.id);
    },
  ),

  createTeam: os.createTeam.handler(
    async ({ input, context, errors }): Promise<TournamentParticipantListResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      if (tournament.playMode !== "2v2") {
        throw badRequest(TEAMS_NEED_2V2);
      }
      const [firstId, secondId] = input.participantIds;
      if (firstId === secondId || firstId === undefined || secondId === undefined) {
        throw badRequest("A team needs two different players.");
      }
      const members = await Promise.all([
        loadParticipant(repos, input.id, firstId),
        loadParticipant(repos, input.id, secondId),
      ]);
      for (const member of members) {
        if (member.status !== "active") {
          throw badRequest("Only active participants can join a team.");
        }
        if (member.teamId !== null) {
          throw errors.CONFLICT({
            message: `${memberNameEnglish(member.displayName, member.displayName === null)} is already on a team`,
          });
        }
      }
      const team = await repos.podTournaments.createTeam(input.id, [firstId, secondId]);
      if (!team.created && team.reason === "not_2v2") {
        throw badRequest(TEAMS_NEED_2V2);
      }
      if (!team.created) {
        throw conflict("A player is already on a team or no longer in this tournament.");
      }
      return buildParticipantList(repos, input.id);
    },
  ),

  dissolveTeam: os.dissolveTeam.handler(
    async ({ input, context, errors }): Promise<TournamentParticipantListResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await context.transact(async (trxRepos) => {
        await trxRepos.tournaments.lockRounds(input.id);
        const team = await trxRepos.podTournaments.getTeam(input.teamId);
        if (!team || team.tournamentId !== input.id) {
          throw notFound("Team not found");
        }
        // A team that has played is part of the recorded rounds; standings and
        // rematch history would silently degrade if it fell apart.
        if (await trxRepos.podTournaments.teamHasMemberships(input.teamId)) {
          throw errors.CONFLICT({ message: "A team that has played a round cannot be dissolved" });
        }
        await trxRepos.podTournaments.dissolveTeam(input.teamId);
      });
      return buildParticipantList(repos, input.id);
    },
  ),

  // runState is readable by anyone with a relationship to the tournament;
  // round-running mutations require manage authority, never owner-only.

  runState: os.runState.handler(
    async ({ input, context }): Promise<PodTournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      if (!(await repos.tournaments.hasRelationship(input.id, userId))) {
        throw notFound("Tournament not found");
      }
      return buildPodRunDetail(repos, tournament);
    },
  ),
  standingsSnapshot: os.standingsSnapshot.handler(async ({ input, context }) => {
    const repos = context.repos;
    const tournament = await loadTournament(repos, input.id);
    if (!(await repos.tournaments.hasRelationship(input.id, context.userId))) {
      throw notFound("Tournament not found");
    }
    return buildStandingsSnapshot(repos, tournament, input.throughRound);
  }),

  generateRound: os.generateRound.handler(
    async ({ input, context }): Promise<PodTournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await context.transact(async (trxRepos) => {
        // Re-read under the lock: a settings edit committed while this waited
        // may have changed the play mode or the format.
        const current = await loadTournamentForWrite(trxRepos, input.id);
        await (isGroupCut(current)
          ? generateGroupCutRound(trxRepos, current)
          : pairNextRound(trxRepos, current, input.byes));
      });
      return podRunDetailById(repos, input.id);
    },
  ),

  startGroupRound: os.startGroupRound.handler(
    async ({ input, context }): Promise<PodTournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireStaff(repos, tournament, userId);
      await context.transact(async (trxRepos) => {
        const current = await loadTournamentForWrite(trxRepos, input.id);
        assertGroupCutRun(current);
        await startGroupRoundEngine(trxRepos, current, input.groupId);
      });
      return podRunDetailById(repos, input.id);
    },
  ),

  startGroupStageRound: os.startGroupStageRound.handler(
    async ({ input, context }): Promise<PodTournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await context.transact(async (trxRepos) => {
        const current = await loadTournamentForWrite(trxRepos, input.id);
        assertGroupCutRun(current);
        await startGroupStageRoundEngine(trxRepos, current);
      });
      return podRunDetailById(repos, input.id);
    },
  ),

  setLegendMetaShares: os.setLegendMetaShares.handler(
    async ({ input, context }): Promise<PodTournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await context.transact(async (trxRepos) =>
        setLegendMetaShares(
          trxRepos,
          await loadTournamentForWrite(trxRepos, input.id),
          input.shares,
        ),
      );
      return podRunDetailById(repos, input.id);
    },
  ),

  replaceGroupSeats: os.replaceGroupSeats.handler(
    async ({ input, context }): Promise<PodTournamentDetailResponse> => {
      const repos = context.repos;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, context.userId);
      await context.transact(async (trxRepos) =>
        replaceGroupSeats(trxRepos, await loadTournamentForWrite(trxRepos, input.id), input.groups),
      );
      return podRunDetailById(repos, input.id);
    },
  ),

  replaceCutPairing: os.replaceCutPairing.handler(
    async ({ input, context }): Promise<PodTournamentDetailResponse> => {
      const repos = context.repos;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, context.userId);
      await context.transact(async (trxRepos) =>
        replaceCutRoundPairing(
          trxRepos,
          await loadTournamentForWrite(trxRepos, input.id),
          input.roundNumber,
          input.pods,
        ),
      );
      return podRunDetailById(repos, input.id);
    },
  ),

  replacePairing: os.replacePairing.handler(
    async ({ input, context }): Promise<PodTournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await context.transact(async (trxRepos) => {
        const current = await loadTournamentForWrite(trxRepos, input.id);
        assertCutRoundEditable(current, input.roundNumber);
        await replaceRoundPairing(trxRepos, current, input.roundNumber, input.pods, input.byes);
      });
      return podRunDetailById(repos, input.id);
    },
  ),

  rerollRound: os.rerollRound.handler(
    async ({ input, context }): Promise<PodTournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await context.transact(async (trxRepos) => {
        const current = await loadTournamentForWrite(trxRepos, input.id);
        await (isGroupCut(current)
          ? rerollGroupCutRound(trxRepos, current, input.roundNumber)
          : rerollRoundEngine(trxRepos, current, input.roundNumber));
      });
      return podRunDetailById(repos, input.id);
    },
  ),

  finalizeRound: os.finalizeRound.handler(
    async ({ input, context }): Promise<PodTournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await context.transact(async (trxRepos) => {
        const current = await loadTournamentForWrite(trxRepos, input.id);
        assertCutRoundEditable(current, input.roundNumber);
        await finalizeRoundEngine(trxRepos, current, input.roundNumber);
        await completeAfterFinal(trxRepos, current, input.roundNumber);
      });
      return podRunDetailById(repos, input.id);
    },
  ),

  submitResult: os.submitResult.handler(
    async ({ input, context }): Promise<PodTournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await context.transact((trxRepos) =>
        submitPodResult(trxRepos, tournament.id, input.podId, input.results, {
          allowFinalized: true,
          drawnGames: input.drawnGames,
        }),
      );
      return podRunDetailById(repos, input.id);
    },
  ),

  clearResult: os.clearResult.handler(
    async ({ input, context }): Promise<PodTournamentDetailResponse> => {
      const repos = context.repos;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, context.userId);
      await context.transact((trxRepos) => clearPodResult(trxRepos, tournament.id, input.podId));
      return podRunDetailById(repos, input.id);
    },
  ),

  enableReportToken: os.enableReportToken.handler(
    async ({ input, context }): Promise<TournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await withUniqueShareToken(
        (token) =>
          context.transact(async (trxRepos) => {
            await loadTournamentForWrite(trxRepos, tournament.id);
            await trxRepos.tournaments.setReportToken(tournament.id, token);
          }),
        { constraint: "uq_tournaments_report_token" },
      );
      return detailById(repos, input.id, userId);
    },
  ),

  disableReportToken: os.disableReportToken.handler(
    async ({ input, context }): Promise<TournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await context.transact(async (trxRepos) => {
        await loadTournamentForWrite(trxRepos, tournament.id);
        await trxRepos.tournaments.setReportToken(tournament.id, null);
      });
      return detailById(repos, input.id, userId);
    },
  ),

  enableFollowToken: os.enableFollowToken.handler(
    async ({ input, context }): Promise<TournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await withUniqueShareToken(
        (token) => repos.tournaments.setFollowToken(tournament.id, token),
        { constraint: "uq_tournaments_follow_token" },
      );
      return detailById(repos, input.id, userId);
    },
  ),

  disableFollowToken: os.disableFollowToken.handler(
    async ({ input, context }): Promise<TournamentDetailResponse> => {
      const repos = context.repos;
      const userId = context.userId;
      const tournament = await loadTournament(repos, input.id);
      await requireManage(repos, tournament, userId);
      await repos.tournaments.setFollowToken(tournament.id, null);
      return detailById(repos, input.id, userId);
    },
  ),
};
