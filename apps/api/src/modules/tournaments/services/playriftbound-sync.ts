import { deckCheckIngestEntrySchema } from "@openrift/shared/contracts/deck-check-ingest";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import type {
  PlayriftboundSyncPayload,
  PlayriftboundSyncRegistrant,
} from "@openrift/shared/playriftbound-sync";
import {
  parsePlayriftboundDeckText,
  PLAYRIFTBOUND_EXTERNAL_ID_PREFIX,
  playriftboundExternalId,
  playriftboundRiotId,
} from "@openrift/shared/playriftbound-sync";
import type { PlayriftboundSyncResponse } from "@openrift/shared/types/api/tournament";
import { z } from "zod";

import type { Repos, Transact } from "../../../deps.js";
import { AppError, conflict } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import { retryOnClaimTokenCollision } from "../lib/claim-token.js";
import { loadTournamentForWrite } from "../lib/tournament-access.js";
import type { Tournament, TournamentParticipant } from "../repositories/tournaments-shared.js";
import type { IngestEntry } from "./deck-check-ingest.js";
import { prepareDeckCheckPush, writeDeckCheckPush } from "./deck-check-ingest.js";
import { dropParticipant } from "./participant-drops.js";

function assertSyncable(tournament: Tournament, eventId: string): void {
  if (tournament.status === "cancelled" || tournament.status === "completed") {
    throw conflict("A completed or cancelled tournament cannot be synced.");
  }
  if (tournament.deckSubmission === "none") {
    throw conflict("Turn on deck submission for this tournament before syncing decks into it.");
  }
  if (tournament.playriftboundEventId !== null && tournament.playriftboundEventId !== eventId) {
    throw conflict("This tournament is linked to a different playriftbound event.");
  }
}

/** The last copy of a player wins, so a payload that lists someone twice still syncs once. */
function uniqueRegistrants(payload: PlayriftboundSyncPayload): PlayriftboundSyncRegistrant[] {
  return [...new Map(payload.registrants.map((r) => [r.playerId, r])).values()];
}

export interface PlayriftboundSyncState {
  participantsByExternalId: Map<string, TournamentParticipant>;
  entryExternalIds: Set<string>;
  participantsWithEntry: Set<string>;
}

export interface PlannedPush {
  entries: IngestEntry[];
  kept: number;
}

/**
 * Pushes a list only when the player saved it again at the source, so what a
 * judge or player did to the synced list on OpenRift stays until then.
 */
export function planPlayriftboundPush(
  registrants: PlayriftboundSyncRegistrant[],
  state: PlayriftboundSyncState,
): PlannedPush {
  const entries: IngestEntry[] = [];
  let kept = 0;
  for (const registrant of registrants) {
    if (registrant.deck === null) {
      continue;
    }
    const externalId = playriftboundExternalId(registrant.playerId);
    const participant = state.participantsByExternalId.get(externalId);
    const savedAt = new Date(registrant.deck.lastSavedAt).getTime();
    if (participant?.sourceDeckSavedAt?.getTime() === savedAt) {
      continue;
    }
    const isNew = !state.entryExternalIds.has(externalId);
    if (isNew && participant !== undefined && state.participantsWithEntry.has(participant.id)) {
      kept += 1;
      continue;
    }
    entries.push({
      externalId,
      playerName: registrant.displayName,
      riotId: playriftboundRiotId(registrant),
      submittedAt: registrant.deck.lastSavedAt,
      cards: parsePlayriftboundDeckText(registrant.deck.deckText).cards,
      ...(isNew
        ? { allowDeckPublishing: false, allowNameSharing: false, allowRiotIdSharing: false }
        : {}),
    });
  }
  return { entries, kept };
}

function assertIngestable(entries: IngestEntry[]): void {
  for (const entry of entries) {
    const parsed = deckCheckIngestEntrySchema.safeParse(entry);
    if (!parsed.success) {
      throw new AppError(
        422,
        ERROR_CODES.VALIDATION_ERROR,
        `The list of ${entry.playerName} cannot be synced: ${z.prettifyError(parsed.error)}`,
      );
    }
  }
}

async function loadSyncState(repos: Repos, tournamentId: string): Promise<PlayriftboundSyncState> {
  const [entries, participants] = await Promise.all([
    repos.deckCheck.listEntriesForEvent(tournamentId),
    repos.tournaments.listParticipantsByExternalPrefix(
      tournamentId,
      PLAYRIFTBOUND_EXTERNAL_ID_PREFIX,
    ),
  ]);
  return {
    participantsByExternalId: new Map(
      participants.flatMap((participant) =>
        participant.externalId === null ? [] : [[participant.externalId, participant] as const],
      ),
    ),
    entryExternalIds: new Set(entries.map((entry) => entry.externalId)),
    participantsWithEntry: new Set(
      entries.flatMap((entry) => (entry.participantId === null ? [] : [entry.participantId])),
    ),
  };
}

interface RosterCounts {
  participantsCreated: number;
  participantsUpdated: number;
  participantsLeft: number;
}

/**
 * Drops go through the drop service, and a sync never reactivates anyone, so
 * a judge's drop stands. A claimed or closed participant keeps its identity.
 */
async function upsertRoster(
  repos: Repos,
  tournamentId: string,
  registrants: PlayriftboundSyncRegistrant[],
  state: PlayriftboundSyncState,
): Promise<RosterCounts> {
  const counts: RosterCounts = {
    participantsCreated: 0,
    participantsUpdated: 0,
    participantsLeft: 0,
  };
  for (const registrant of registrants) {
    const externalId = playriftboundExternalId(registrant.playerId);
    const riotId = playriftboundRiotId(registrant);
    const existing = state.participantsByExternalId.get(externalId);
    if (existing === undefined) {
      const created = await repos.tournaments.createParticipant({
        tournamentId,
        displayName: registrant.displayName,
        riotId,
        externalId,
        status: registrant.dropped ? "dropped" : "active",
      });
      state.participantsByExternalId.set(externalId, created);
      counts.participantsCreated += 1;
      continue;
    }
    const ownsIdentity = existing.userId === null && !existing.isAccountClosed;
    const identity = {
      ...(ownsIdentity && existing.displayName !== registrant.displayName
        ? { displayName: registrant.displayName }
        : {}),
      ...(ownsIdentity && existing.riotId !== riotId ? { riotId } : {}),
    };
    const drops = registrant.dropped && existing.status === "active";
    if (Object.keys(identity).length > 0) {
      await repos.tournaments.updateParticipant(existing.id, identity);
    }
    if (drops) {
      await dropParticipant(repos, tournamentId, existing.id);
    }
    if (drops || Object.keys(identity).length > 0) {
      counts.participantsUpdated += 1;
    }
  }

  const listed = new Set(registrants.map((r) => playriftboundExternalId(r.playerId)));
  for (const [externalId, participant] of state.participantsByExternalId) {
    if (listed.has(externalId) || participant.status !== "active") {
      continue;
    }
    await dropParticipant(repos, tournamentId, participant.id);
    counts.participantsLeft += 1;
  }
  return counts;
}

/**
 * Links the tournament to the playriftbound event and brings its synced roster
 * and lists up to date. Players added on OpenRift by other means are never touched.
 */
export async function syncPlayriftboundEvent(
  repos: Repos,
  transact: Transact,
  tournament: Tournament,
  payload: PlayriftboundSyncPayload,
  appBaseUrl: string,
): Promise<PlayriftboundSyncResponse> {
  const eventId = payload.event.eventId;
  assertSyncable(tournament, eventId);
  const registrants = uniqueRegistrants(payload);
  const outline = planPlayriftboundPush(registrants, await loadSyncState(repos, tournament.id));
  assertIngestable(outline.entries);
  const prepared = await prepareDeckCheckPush(repos, outline.entries);
  const savedAt = new Map(
    registrants.flatMap((registrant) =>
      registrant.deck === null
        ? []
        : [[playriftboundExternalId(registrant.playerId), new Date(registrant.deck.lastSavedAt)]],
    ),
  );

  return retryOnClaimTokenCollision(() =>
    transact(async (trx) => {
      const current = await loadTournamentForWrite(trx, tournament.id);
      assertSyncable(current, eventId);
      if (current.playriftboundEventId === null) {
        await trx.tournaments.updateSettings(current.id, { playriftboundEventId: eventId });
      }

      // The plan is redone under the lock; card resolution from the outline still applies.
      const state = await loadSyncState(trx, current.id);
      const plan = planPlayriftboundPush(registrants, state);
      const planned = new Set(plan.entries.map((entry) => entry.externalId));
      const lists = prepared.filter((list) => planned.has(list.entry.externalId));

      const roster = await upsertRoster(trx, current.id, registrants, state);
      const event = await trx.deckCheck.getEventById(current.id);
      assertFound(event, "Tournament not found");
      const pushed = await writeDeckCheckPush(trx, event, lists, appBaseUrl, {
        rosterSynced: true,
      });
      for (const list of lists) {
        const participant = state.participantsByExternalId.get(list.entry.externalId);
        if (participant !== undefined) {
          await trx.tournaments.updateParticipant(participant.id, {
            sourceDeckSavedAt: savedAt.get(list.entry.externalId) ?? null,
          });
        }
      }

      return {
        tournamentId: current.id,
        ...roster,
        decksCreated: pushed.entriesCreated,
        decksUpdated: pushed.entriesUpdated,
        decksUnchanged: savedAt.size - lists.length - plan.kept + pushed.entriesUnchanged,
        decksKept: plan.kept,
        checksInvalidated: pushed.checksInvalidated,
      };
    }),
  );
}
