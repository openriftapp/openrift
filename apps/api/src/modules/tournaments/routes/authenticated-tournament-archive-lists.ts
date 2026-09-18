import { tournamentArchiveListsContract } from "@openrift/shared/contracts/tournament-archive-lists";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { createLogger } from "@openrift/shared/logger";
import { effectiveTournamentState } from "@openrift/shared/tournament-lifecycle";
import type {
  ArchiveListSendResponse,
  ArchiveListStateResponse,
} from "@openrift/shared/types/api/tournament";
import { implement } from "@orpc/server";

import type { Repos } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { createMetaSyncDeps } from "../../meta/services/meta-sync/index.js";
import {
  archiveListEligibility,
  canSendArchiveList,
  suggestArchiveListIdentities,
} from "../lib/archive-lists.js";
import { loadTournament, requireManage } from "../lib/tournament-access.js";
import type { Tournament } from "../repositories/tournaments-shared.js";

const log = createLogger("tournament-archive-lists");

const os = implement(tournamentArchiveListsContract).$context<ApiContext>().use(requireAuthedUser);

const SEATED_STATUSES = new Set(["active", "dropped"]);

const SUGGESTION_WINDOW_MS = 36 * 60 * 60 * 1000;

function isCompleted(tournament: Tournament, now: Date): boolean {
  return (
    effectiveTournamentState(
      tournament.startsAt.toISOString(),
      tournament.endsAt?.toISOString() ?? null,
      tournament.status,
      now,
    ) === "completed"
  );
}

type AuthedContext = ApiContext & { userId: string };

async function loadManaged(context: AuthedContext, id: string): Promise<Tournament> {
  const tournament = await loadTournament(context.repos, id);
  await requireManage(context.repos, tournament, context.userId);
  return tournament;
}

async function buildState(
  context: ApiContext,
  tournament: Tournament,
): Promise<ArchiveListStateResponse> {
  const repos: Repos = context.repos;
  const [participants, entries, target] = await Promise.all([
    repos.tournaments.listParticipants(tournament.id),
    tournament.deckSubmission === "none"
      ? Promise.resolve([])
      : repos.deckCheck.listEntriesForEvent(tournament.id),
    tournament.uvsgamesEventId === null
      ? Promise.resolve(null)
      : context.services.loadTournamentListTarget(repos, tournament.uvsgamesEventId),
  ]);
  const entryByParticipant = new Map(entries.map((entry) => [entry.participantId, entry]));
  const seated = participants
    .filter((participant) => SEATED_STATUSES.has(participant.status))
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName));
  const standings = target?.standings ?? [];
  const suggestions = suggestArchiveListIdentities(
    seated.map((participant) => ({
      participantId: participant.id,
      displayName: participant.displayName,
    })),
    standings,
  );

  return {
    uvsgamesEventId: tournament.uvsgamesEventId,
    tournamentCompleted: isCompleted(tournament, new Date()),
    event:
      target === null
        ? null
        : {
            name: target.event.name,
            startAt: target.event.startAt.toISOString(),
            displayStatus: target.event.displayStatus,
            playerCount: target.event.playerCount,
            storeName: target.event.storeName,
            resultsFetchedAt: target.event.resultsFetchedAt?.toISOString() ?? null,
          },
    metaEventSlug: target?.metaEvent?.slug ?? null,
    standings,
    participants: seated.map((participant) => {
      const entry = entryByParticipant.get(participant.id);
      return {
        participantId: participant.id,
        displayName: participant.displayName,
        entryState: entry?.state ?? null,
        eligibility: archiveListEligibility(entry),
        unmatchedLines: entry?.unmatchedLineCount ?? 0,
        suggestedIdentity: suggestions.get(participant.id) ?? null,
      };
    }),
  };
}

function requireLinked(tournament: Tournament): string {
  if (tournament.uvsgamesEventId === null) {
    throw new AppError(409, ERROR_CODES.CONFLICT, "Link the UVS Games event first.");
  }
  return tournament.uvsgamesEventId;
}

export const tournamentArchiveListsRouter = {
  state: os.state.handler(async ({ input, context }): Promise<ArchiveListStateResponse> => {
    const tournament = await loadManaged(context, input.id);
    return await buildState(context, tournament);
  }),

  refresh: os.refresh.handler(async ({ input, context }) => {
    const tournament = await loadManaged(context, input.id);
    const uvsgamesEventId = requireLinked(tournament);
    const deps = createMetaSyncDeps({
      repos: context.repos,
      transact: context.transact,
      fetch: context.io.fetch,
      log,
      baseUrl: context.config.metaSync.baseUrl,
    });
    const fetched = await context.services.fetchUvsgamesEvent(deps, uvsgamesEventId);
    if (fetched.status === "failed") {
      log.warn(
        { uvsgamesEventId, errors: fetched.errors },
        "UVS Games fetch for a tournament failed",
      );
    }
    return { outcome: fetched.status, state: await buildState(context, tournament) };
  }),

  send: os.send.handler(async ({ input, context }): Promise<ArchiveListSendResponse> => {
    const tournament = await loadManaged(context, input.id);
    const uvsgamesEventId = requireLinked(tournament);
    if (!isCompleted(tournament, new Date())) {
      throw new AppError(409, ERROR_CODES.CONFLICT, "Lists can be sent once the tournament ends.");
    }

    const entries =
      tournament.deckSubmission === "none"
        ? []
        : await context.repos.deckCheck.listEntriesForEvent(tournament.id);
    const entryByParticipant = new Map(entries.map((entry) => [entry.participantId, entry]));
    const skipped: ArchiveListSendResponse["skipped"] = [];
    const lists: { participantId: string; identity: string; entryId: string }[] = [];
    const takenIdentities = new Set<string>();
    for (const link of input.links) {
      const entry = entryByParticipant.get(link.participantId);
      if (entry === undefined || !canSendArchiveList(archiveListEligibility(entry), link.force)) {
        skipped.push({ participantId: link.participantId, reason: "not_eligible" });
        continue;
      }
      if (takenIdentities.has(link.identity)) {
        skipped.push({ participantId: link.participantId, reason: "duplicate_standing" });
        continue;
      }
      takenIdentities.add(link.identity);
      lists.push({ participantId: link.participantId, identity: link.identity, entryId: entry.id });
    }

    const withCards = await Promise.all(
      lists.map(async (list) => {
        const lines = await context.repos.deckCheck.listCardsForEntry(list.entryId);
        return {
          ...list,
          cards: lines.map((line) => ({
            zone: line.zone,
            quantity: line.quantity,
            cardName: line.rawName,
            cardId: line.resolvedCardId,
            preferredPrintingId: line.resolvedPrintingId,
          })),
        };
      }),
    );
    const sendable = withCards.filter((list) => list.cards.length > 0);
    for (const list of withCards) {
      if (list.cards.length === 0) {
        skipped.push({ participantId: list.participantId, reason: "not_eligible" });
      }
    }

    const participantByIdentity = new Map(sendable.map((list) => [list.identity, list]));
    const result =
      sendable.length === 0
        ? { eventName: "", sent: 0, updated: 0, skipped: [] }
        : await context.services.sendTournamentLists(context.transact, {
            userId: context.userId,
            tournamentName: tournament.name,
            uvsgamesEventId,
            fallbackFormat: tournament.deckFormat,
            lists: sendable.map((list) => ({ identity: list.identity, cards: list.cards })),
          });
    for (const skip of result.skipped) {
      const list = participantByIdentity.get(skip.identity);
      if (list !== undefined) {
        skipped.push({ participantId: list.participantId, reason: skip.reason });
      }
    }

    if (result.sent + result.updated > 0) {
      await context.services.notifyAdminsOfMetaSubmission(context.repos, {
        submitterUserId: context.userId,
        kind: "new_list",
        eventName: result.eventName,
        playerName: null,
        note: `Sent from the OpenRift tournament "${tournament.name}".`,
        summary: `${result.sent + result.updated} decklists from a hosted tournament`,
      });
    }
    return { sent: result.sent, updated: result.updated, skipped };
  }),

  uvsgamesSuggestions: os.uvsgamesSuggestions.handler(async ({ input, context }) => {
    const tournament = await loadManaged(context, input.id);
    if (tournament.groupId === null) {
      return { items: [] };
    }
    const start = tournament.startsAt.getTime();
    const rows = await context.repos.friendGroupShops.listEventsBetween(
      tournament.groupId,
      new Date(start - SUGGESTION_WINDOW_MS),
      new Date(start + SUGGESTION_WINDOW_MS),
    );
    return {
      items: rows.map((row) => ({
        externalId: row.externalId,
        name: row.name,
        startAt: row.startAt.toISOString(),
        storeName: row.storeName,
      })),
    };
  }),
};
