import { tournamentDeckCheckContract } from "@openrift/shared/contracts/tournament-deck-check";
import { mapSectionToZone } from "@openrift/shared/deck-check";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import type {
  DeckCheckEntryDetailResponse,
  DeckCheckEventDetailResponse,
} from "@openrift/shared/types/api/deck-check";
import { implement } from "@orpc/server";

import type { Repos } from "../../../deps.js";
import { AppError, conflict, forbidden, notFound } from "../../../errors.js";
import { assertExisted, assertFound } from "../../../lib/assertions.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { computeZoneSuggestions } from "../lib/deck-check-advisories.js";
import { presentDeadlineSettled, presentDeadlineSettledEntry } from "../lib/deck-check-deadline.js";
import { buildEntryDetail, toEntrySummary, toEventSummary } from "../lib/deck-check-presenters.js";
import { assertIdentityEditable, loadDeckCheckEventForWrite } from "../lib/tournament-access.js";
import type { DeckCheckEntry } from "../repositories/deck-check-entries.js";
import type { DeckCheckEvent } from "../repositories/deck-check-events.js";
import {
  cardResolutionKey,
  resolveDeckCheckCards,
} from "../services/deck-check-card-resolution.js";
import {
  createManualDeckCheckEntry,
  prepareManualDeckCheckList,
  refreshEditedEntry,
} from "../services/deck-check-ingest.js";
import { syncDeckCheckLegend } from "../services/deck-check-legend.js";
import { linesFromDeckCode } from "../services/deck-check-player.js";
import {
  applyJudgeTransition,
  settleExpiredEditable,
  settleExpiredEditableEntries,
} from "../services/deck-check-states.js";

/**
 * Loads a deck-check tournament and authorizes a judge action: the tournament
 * host, or a `tournament_staff` organizer/judge, may act. 404s when the
 * tournament is missing or does not have deck check enabled.
 */
async function authorizeJudge(
  repos: Repos,
  tournamentId: string,
  userId: string,
): Promise<DeckCheckEvent> {
  const event = await repos.deckCheck.getEventById(tournamentId);
  assertFound(event, "Tournament not found");
  const allowed = await repos.tournaments.isHostOrStaff(tournamentId, userId, [
    "organizer",
    "judge",
  ]);
  if (!allowed) {
    throw forbidden("Judges only");
  }
  return event;
}

/** Read-only: an entry left editable past the deadline is presented as submitted. */
async function loadEntry(
  repos: Repos,
  event: DeckCheckEvent,
  entryId: string,
): Promise<DeckCheckEntry> {
  const entry = await repos.deckCheck.getEntry(event.id, entryId);
  assertFound(entry, "Entry not found");
  return await presentDeadlineSettledEntry(repos, event, entry);
}

/** For write paths: persists the event's deadline auto-submits before loading. */
async function loadEntryForWrite(
  repos: Repos,
  event: DeckCheckEvent,
  entryId: string,
): Promise<DeckCheckEntry> {
  await settleExpiredEditableEntries(repos, event);
  const entry = await repos.deckCheck.getEntry(event.id, entryId);
  assertFound(entry, "Entry not found");
  return entry;
}

/**
 * Guards every card-level judge action: an editable list has not been
 * delivered to an official, so judges can neither read nor touch its lines
 * until the player submits.
 */
function requireListVisible(entry: DeckCheckEntry): void {
  if (entry.state === "editable") {
    throw conflict("The player is editing this list. It becomes visible once submitted.");
  }
}

/**
 * Locks participant before entry, the order the player's save paths take, since
 * the legend sync writes the participant row. Re-checks visibility under the lock.
 */
async function lockVisibleEntry(
  txRepos: Repos,
  event: DeckCheckEvent,
  entry: DeckCheckEntry,
): Promise<DeckCheckEntry> {
  if (entry.participantId !== null) {
    await txRepos.tournaments.lockParticipant(entry.participantId);
  }
  const locked = await txRepos.deckCheck.getEntryForUpdate(event.id, entry.id);
  assertFound(locked, "Entry not found");
  requireListVisible(locked);
  return locked;
}

/**
 * A judge's card edit and the content-hash refresh commit together, serialized per entry.
 * An edit returning `false` changed nothing and skips the refresh.
 */
function editVisibleList<T>(
  context: ApiContext,
  event: DeckCheckEvent,
  entry: DeckCheckEntry,
  edit: (txRepos: Repos) => Promise<T>,
): Promise<T> {
  return context.transact(async (txRepos) => {
    const locked = await lockVisibleEntry(txRepos, event, entry);
    const result = await edit(txRepos);
    if (result !== false) {
      await refreshEditedEntry(txRepos, locked);
    }
    return result;
  });
}

/** A card row replaced by a re-import, or a copy index past its quantity, while the judge had the entry open. */
function requireCardStillListed(found: boolean): void {
  if (!found) {
    throw conflict("Card list changed. Reload the entry.");
  }
}

const os = implement(tournamentDeckCheckContract).$context<ApiContext>().use(requireAuthedUser);

/** Thrown `AppError`s map to ORPCErrors at the handler boundary. */
export const tournamentDeckCheckRouter = {
  listEntries: os.listEntries.handler(
    async ({ input, context }): Promise<DeckCheckEventDetailResponse> => {
      const repos = context.repos;
      const event = await authorizeJudge(repos, input.tournamentId, context.userId);
      const entries = await presentDeadlineSettled(
        repos,
        event,
        await repos.deckCheck.listEntriesForEvent(event.id),
      );
      const active = entries.filter((entry) => entry.state !== "withdrawn");
      const summary = toEventSummary({
        ...event,
        entryCount: active.length,
        approvedCount: active.filter((entry) => entry.state === "approved").length,
        checkedCount: active.filter((entry) => entry.state === "checked").length,
      });
      return { event: summary, entries: entries.map((entry) => toEntrySummary(entry)) };
    },
  ),

  createEntry: os.createEntry.handler(
    async ({ input, context }): Promise<DeckCheckEntryDetailResponse> => {
      const repos = context.repos;
      const event = await authorizeJudge(repos, input.tournamentId, context.userId);
      if (event.status === "archived") {
        throw conflict("Event is archived. Un-archive it before adding decks.");
      }
      const participant = await repos.tournaments.getParticipantById(input.participantId);
      if (!participant || participant.tournamentId !== event.id) {
        throw notFound("Participant not found");
      }
      let cards = input.cards;
      if (input.deckCode !== undefined) {
        const lines = await linesFromDeckCode(repos, input.deckCode);
        cards = lines.map((line) => ({
          name: line.name,
          quantity: line.quantity,
          section: line.zone,
        }));
      }
      const list = await prepareManualDeckCheckList(repos, cards);
      // No unique constraint on participant_id; the has-deck check re-runs under a
      // participant row lock to close the judge-double-click race.
      const created = await context.transact(async (trxRepos) => {
        const current = await loadDeckCheckEventForWrite(trxRepos, event.id);
        if (current.status === "archived") {
          throw conflict("Event is archived. Un-archive it before adding decks.");
        }
        if (!(await trxRepos.tournaments.lockParticipant(participant.id))) {
          throw notFound("Participant not found");
        }
        if (await trxRepos.deckCheck.participantHasDeck(participant.id)) {
          throw conflict("This participant already has a deck");
        }
        return createManualDeckCheckEntry(trxRepos, event.id, participant.id, list);
      });
      return buildEntryDetail(repos, event, created);
    },
  ),

  getEntry: os.getEntry.handler(
    async ({ input, context }): Promise<DeckCheckEntryDetailResponse> => {
      const repos = context.repos;
      const event = await authorizeJudge(repos, input.tournamentId, context.userId);
      const entry = await loadEntry(repos, event, input.entryId);
      return buildEntryDetail(repos, event, entry);
    },
  ),

  setEntryState: os.setEntryState.handler(
    async ({ input, context }): Promise<DeckCheckEntryDetailResponse> => {
      const repos = context.repos;
      const event = await authorizeJudge(repos, input.tournamentId, context.userId);
      // This 404s fast, outside the transaction; it is not the entry the transition validates against.
      const current = await repos.deckCheck.getEntry(event.id, input.entryId);
      assertFound(current, "Entry not found");

      const updated = await context.transact(async (txRepos) => {
        // Row-locked re-load: without it, two concurrent judge requests validate
        // against stale state and the second commit overwrites the first's.
        if (current.participantId !== null) {
          await txRepos.tournaments.lockParticipant(current.participantId);
        }
        const fresh = await txRepos.deckCheck.getEntryForUpdate(event.id, input.entryId);
        assertFound(fresh, "Entry not found");
        const settled = await settleExpiredEditable(txRepos, event, fresh);
        const transitioned = await applyJudgeTransition(txRepos, context.userId, settled, {
          state: input.state,
          reviewOutcome: input.reviewOutcome,
          notes: input.notes,
          playerMessage: input.playerMessage,
        });
        if (settled.state === "withdrawn" || transitioned.state === "withdrawn") {
          await syncDeckCheckLegend(txRepos, transitioned);
        }
        return transitioned;
      });
      return buildEntryDetail(repos, event, updated);
    },
  ),

  denyUnlockRequest: os.denyUnlockRequest.handler(
    async ({ input, context }): Promise<DeckCheckEntryDetailResponse> => {
      const repos = context.repos;
      const event = await authorizeJudge(repos, input.tournamentId, context.userId);
      const entry = await loadEntryForWrite(repos, event, input.entryId);

      const updated = entry.unlockRequestedAt
        ? await repos.deckCheck.updateEntry(entry.id, { unlockRequestedAt: null })
        : entry;
      return buildEntryDetail(repos, event, updated ?? entry);
    },
  ),

  updateEntry: os.updateEntry.handler(
    async ({ input, context }): Promise<DeckCheckEntryDetailResponse> => {
      const repos = context.repos;
      const event = await authorizeJudge(repos, input.tournamentId, context.userId);
      await loadEntryForWrite(repos, event, input.entryId);

      // The participant row lock serializes with an account closing, which
      // clears the stored name the identity check reads.
      const updated = await context.transact(async (txRepos) => {
        await loadDeckCheckEventForWrite(txRepos, event.id);
        const linked = await txRepos.deckCheck.getEntry(event.id, input.entryId);
        assertFound(linked, "Entry not found");
        if (linked.participantId !== null) {
          await txRepos.tournaments.lockParticipant(linked.participantId);
        }
        const entry = await txRepos.deckCheck.getEntry(event.id, input.entryId);
        assertFound(entry, "Entry not found");
        assertIdentityEditable(
          entry.playerName,
          input.playerName !== undefined || input.riotId !== undefined,
        );
        return txRepos.deckCheck.updateEntry(input.entryId, {
          ...(input.playerName === undefined ? {} : { playerName: input.playerName }),
          ...(input.riotId === undefined ? {} : { riotId: input.riotId }),
          ...(input.playerMessage === undefined ? {} : { playerMessage: input.playerMessage }),
          ...(input.allowDeckPublishing === undefined
            ? {}
            : { allowDeckPublishing: input.allowDeckPublishing }),
        });
      });
      assertFound(updated, "Entry not found");
      return buildEntryDetail(repos, event, updated);
    },
  ),

  deleteEntry: os.deleteEntry.handler(async ({ input, context }): Promise<void> => {
    const repos = context.repos;
    const event = await authorizeJudge(repos, input.tournamentId, context.userId);
    const deleted = await repos.deckCheck.deleteEntry(event.id, input.entryId);
    assertExisted(deleted, "Entry not found");
  }),

  addCard: os.addCard.handler(async ({ input, context }): Promise<DeckCheckEntryDetailResponse> => {
    const repos = context.repos;
    const event = await authorizeJudge(repos, input.tournamentId, context.userId);
    const entry = await loadEntryForWrite(repos, event, input.entryId);
    requireListVisible(entry);

    const zone = mapSectionToZone(input.section);
    if (!zone) {
      throw new AppError(
        422,
        ERROR_CODES.VALIDATION_ERROR,
        `Unknown deck section: ${input.section}`,
      );
    }
    const resolutions = await resolveDeckCheckCards(repos, [{ name: input.name }]);
    const resolution = resolutions.get(cardResolutionKey(input.name)) ?? {
      resolvedCardId: null,
      resolvedPrintingId: null,
      matchStatus: "unmatched" as const,
    };
    await editVisibleList(context, event, entry, async ({ deckCheck }) => {
      await deckCheck.lockCardOrder(entry.id);
      const existing = await deckCheck.listCardsForEntry(entry.id);
      await deckCheck.addEntryCard(entry.id, {
        sortOrder: (existing.at(-1)?.sortOrder ?? -1) + 1,
        rawName: input.name,
        section: input.section,
        zone,
        quantity: input.quantity,
        ...resolution,
      });
    });
    const reloaded = await loadEntry(repos, event, input.entryId);
    return buildEntryDetail(repos, event, reloaded);
  }),

  renameCard: os.renameCard.handler(
    async ({ input, context }): Promise<DeckCheckEntryDetailResponse> => {
      const repos = context.repos;
      const event = await authorizeJudge(repos, input.tournamentId, context.userId);
      const entry = await loadEntryForWrite(repos, event, input.entryId);
      requireListVisible(entry);

      const { name, section, copies } = input;
      const resolutions = await resolveDeckCheckCards(repos, [{ name }]);
      const resolution = resolutions.get(cardResolutionKey(name)) ?? {
        resolvedCardId: null,
        resolvedPrintingId: null,
        matchStatus: "unmatched" as const,
      };

      const zone = section === undefined ? undefined : mapSectionToZone(section);
      if (section !== undefined && !zone) {
        throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, `Unknown deck section: ${section}`);
      }
      await editVisibleList(context, event, entry, async ({ deckCheck }) => {
        const updated =
          section === undefined || !zone
            ? await deckCheck.updateCardName(entry.id, input.cardId, name, resolution)
            : await deckCheck.moveCardCopies(entry.id, input.cardId, {
                name,
                resolution,
                section,
                zone,
                copies,
              });
        requireCardStillListed(updated);
      });
      const reloaded = await loadEntry(repos, event, input.entryId);
      return buildEntryDetail(repos, event, reloaded);
    },
  ),

  applyZoneFixes: os.applyZoneFixes.handler(
    async ({ input, context }): Promise<DeckCheckEntryDetailResponse> => {
      const repos = context.repos;
      const event = await authorizeJudge(repos, input.tournamentId, context.userId);
      const entry = await loadEntryForWrite(repos, event, input.entryId);
      requireListVisible(entry);

      // The client names which cards to move, never the destination; only a
      // currently-suggested move is applied, so a forged id is a no-op.
      await editVisibleList(context, event, entry, async ({ deckCheck }) => {
        const cards = await deckCheck.listCardsForEntry(entry.id);
        const matchedIds = [
          ...new Set(
            cards.flatMap((card) =>
              card.matchStatus === "matched" && card.resolvedCardId ? [card.resolvedCardId] : [],
            ),
          ),
        ];
        const details = await deckCheck.getCardDetails(matchedIds);
        const suggestionById = new Map(
          computeZoneSuggestions(cards, details).map((suggestion) => [
            suggestion.cardId,
            suggestion,
          ]),
        );
        let applied = false;
        for (const cardId of new Set(input.cardIds)) {
          const suggestion = suggestionById.get(cardId);
          if (suggestion) {
            await deckCheck.updateCardZone(
              entry.id,
              cardId,
              suggestion.suggestedZone,
              suggestion.suggestedZone,
            );
            applied = true;
          }
        }
        return applied;
      });
      const reloaded = await loadEntry(repos, event, input.entryId);
      return buildEntryDetail(repos, event, reloaded);
    },
  ),

  removeCardCopy: os.removeCardCopy.handler(async ({ input, context }): Promise<void> => {
    const repos = context.repos;
    const event = await authorizeJudge(repos, input.tournamentId, context.userId);
    const entry = await loadEntryForWrite(repos, event, input.entryId);
    requireListVisible(entry);

    await editVisibleList(context, event, entry, async ({ deckCheck }) => {
      const removed = await deckCheck.deleteEntryCardCopy(
        input.entryId,
        input.cardId,
        input.copyIndex,
      );
      requireCardStillListed(removed);
    });
  }),

  tickCard: os.tickCard.handler(async ({ input, context }): Promise<void> => {
    const repos = context.repos;
    const event = await authorizeJudge(repos, input.tournamentId, context.userId);
    const entry = await loadEntryForWrite(repos, event, input.entryId);
    requireListVisible(entry);

    await context.transact(async (txRepos) => {
      await lockVisibleEntry(txRepos, event, entry);
      requireCardStillListed(
        await txRepos.deckCheck.setCardCopyFound(
          input.entryId,
          input.cardId,
          input.copyIndex,
          input.found,
        ),
      );
    });
  }),

  unlinkEntry: os.unlinkEntry.handler(
    async ({ input, context }): Promise<DeckCheckEntryDetailResponse> => {
      const repos = context.repos;
      const event = await authorizeJudge(repos, input.tournamentId, context.userId);
      await loadEntryForWrite(repos, event, input.entryId);

      const updated = await repos.deckCheck.unlinkEntry(input.entryId);
      assertFound(updated, "Entry not found");
      return buildEntryDetail(repos, event, updated);
    },
  ),

  reResolve: os.reResolve.handler(async ({ input, context }): Promise<{ updatedLines: number }> => {
    const repos = context.repos;
    const event = await authorizeJudge(repos, input.tournamentId, context.userId);
    await settleExpiredEditableEntries(repos, event);

    const unresolved = await repos.deckCheck.listUnresolvedCardsForEvent(event.id);
    const resolutions = await resolveDeckCheckCards(
      repos,
      unresolved.map((card) => ({ name: card.rawName })),
    );
    let updatedLines = 0;
    for (const card of unresolved) {
      const resolution = resolutions.get(cardResolutionKey(card.rawName));
      if (!resolution || resolution.matchStatus === card.matchStatus) {
        continue;
      }
      await repos.deckCheck.updateCardResolution(card.id, resolution);
      updatedLines += 1;
    }
    if (updatedLines > 0) {
      await repos.tournamentGroups.syncParticipantLegendsFromDeckCheck(event.id);
    }
    return { updatedLines };
  }),
};
