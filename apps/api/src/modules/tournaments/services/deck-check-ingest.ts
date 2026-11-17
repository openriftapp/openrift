import { randomUUID } from "node:crypto";

import type { deckCheckIngestSchema } from "@openrift/shared/contracts/deck-check-ingest";
import {
  buildContentHashInput,
  diffCardLines,
  MANUAL_ENTRY_EXTERNAL_ID_PREFIX,
  mapSectionToZone,
  SELF_SUBMIT_EXTERNAL_ID_PREFIX,
} from "@openrift/shared/deck-check";
import type { DeckCheckCardLine } from "@openrift/shared/deck-check";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import type { DeckCheckIngestResultResponse } from "@openrift/shared/types/api/deck-check";
import { WellKnown } from "@openrift/shared/well-known";
import type { z } from "zod";

import type { Repos, Transact } from "../../../deps.js";
import { AppError, conflict } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import { sha256HexSync } from "../../../lib/hash.js";
import { generateShareToken } from "../../../lib/share-token.js";
import { retryOnClaimTokenCollision } from "../lib/claim-token.js";
import { storedCardLines } from "../lib/deck-check-deadline.js";
import type { DeckCheckEntry } from "../repositories/deck-check-entries.js";
import type {
  DeckCheckCardResolution,
  NewDeckCheckEntryCard,
} from "../repositories/deck-check-entry-cards.js";
import type { DeckCheckEvent } from "../repositories/deck-check-events.js";
import type { DeckCheckHost } from "../repositories/deck-check-shared.js";
import {
  cardResolutionKey,
  resolveDeckCheckCards,
  UNMATCHED,
} from "./deck-check-card-resolution.js";
import { syncDeckCheckLegend } from "./deck-check-legend.js";

export type DeckCheckIngestPayload = z.infer<typeof deckCheckIngestSchema>;

type IngestEntry = DeckCheckIngestPayload["entries"][number];

/**
 * Maps every entry's sections up front so an unknown section rejects the whole
 * push before anything is written.
 */
function mapAllSections(entries: IngestEntry[]): DeckCheckCardLine[][] {
  const unknownSections = new Set<string>();
  const mapped = entries.map((entry) =>
    entry.cards.map((card) => {
      const zone = mapSectionToZone(card.section);
      if (!zone) {
        unknownSections.add(card.section);
      }
      return {
        name: card.name,
        zone: zone ?? WellKnown.deckZone.MAIN,
        quantity: card.quantity,
      };
    }),
  );
  if (unknownSections.size > 0) {
    throw new AppError(
      422,
      ERROR_CODES.VALIDATION_ERROR,
      `Unknown deck sections: ${[...unknownSections].join(", ")}`,
      { unknownSections: [...unknownSections] },
    );
  }
  return mapped;
}

/** Recomputes the hash from stored lines so a later provider re-push diffs against what the judge sees. */
export async function refreshEditedEntry(
  repos: Repos,
  entry: Pick<DeckCheckEntry, "id" | "tournamentId" | "participantId">,
): Promise<void> {
  const cards = await repos.deckCheck.listCardsForEntry(entry.id);
  await repos.deckCheck.updateEntry(entry.id, {
    contentHash: sha256HexSync(buildContentHashInput(storedCardLines(cards))),
  });
  await syncDeckCheckLegend(repos, entry);
}

export interface PreparedDeckCheckList {
  lines: DeckCheckCardLine[];
  contentHash: string;
  cardRows: NewDeckCheckEntryCard[];
}

function toCardRows(
  cards: { name: string; section: string; quantity: number }[],
  lines: DeckCheckCardLine[],
  resolutions: Map<string, DeckCheckCardResolution>,
): NewDeckCheckEntryCard[] {
  return cards.map((card, sortOrder) => ({
    sortOrder,
    rawName: card.name,
    section: card.section,
    zone: lines[sortOrder]?.zone ?? WellKnown.deckZone.MAIN,
    quantity: card.quantity,
    ...(resolutions.get(cardResolutionKey(card.name)) ?? UNMATCHED),
  }));
}

const UNKNOWN_EVENT = "Unknown tournament id. Create the deck-check tournament in OpenRift first.";

async function loadPushTarget(
  repos: Repos,
  host: DeckCheckHost,
  tournamentId: string,
): Promise<DeckCheckEvent> {
  const event = await repos.deckCheck.getEventForHost(host, tournamentId);
  assertFound(event, UNKNOWN_EVENT);
  if (event.status === "archived") {
    throw conflict("Event is archived. Un-archive it before pushing.");
  }
  return event;
}

/**
 * Upserts the pushed entries into an existing event; absent entries are
 * untouched. Pushes never create events. Card resolution runs on the pool
 * before the transaction, so the tournament lock is never held across a
 * catalog cache load.
 */
export async function ingestDeckCheckPush(
  repos: Repos,
  transact: Transact,
  host: DeckCheckHost,
  payload: DeckCheckIngestPayload,
  appBaseUrl: string,
): Promise<DeckCheckIngestResultResponse> {
  await loadPushTarget(repos, host, payload.tournamentId);

  // The self-submission namespace is reserved: a provider must never upsert
  // onto (or withdraw) an entry the player created.
  const reservedIds = payload.entries
    .map((entry) => entry.externalId)
    .filter((externalId) => externalId.startsWith(SELF_SUBMIT_EXTERNAL_ID_PREFIX));
  if (reservedIds.length > 0) {
    throw new AppError(
      422,
      ERROR_CODES.VALIDATION_ERROR,
      `External ids with the reserved "${SELF_SUBMIT_EXTERNAL_ID_PREFIX}" prefix: ${reservedIds.join(", ")}`,
      { reservedIds },
    );
  }

  const mappedLines = mapAllSections(payload.entries);
  const resolutions = await resolveDeckCheckCards(
    repos,
    mappedLines.flat().map((line) => ({ name: line.name })),
  );
  const lists = payload.entries.map((entry, index) => {
    const lines = mappedLines[index] ?? [];
    return {
      entry,
      lines,
      contentHash: sha256HexSync(buildContentHashInput(lines)),
      cardRows: toCardRows(entry.cards, lines, resolutions),
    };
  });

  return retryOnClaimTokenCollision(() =>
    transact(async (trxRepos) => {
      await trxRepos.tournaments.lockRounds(payload.tournamentId);
      const event = await loadPushTarget(trxRepos, host, payload.tournamentId);
      return writeDeckCheckPush(trxRepos, event, lists, appBaseUrl);
    }),
  );
}

async function writeDeckCheckPush(
  repos: Repos,
  event: DeckCheckEvent,
  lists: (PreparedDeckCheckList & { entry: IngestEntry })[],
  appBaseUrl: string,
): Promise<DeckCheckIngestResultResponse> {
  const result: DeckCheckIngestResultResponse = {
    tournamentId: event.id,
    entriesCreated: 0,
    entriesUpdated: 0,
    entriesUnchanged: 0,
    entriesWithdrawn: 0,
    checksInvalidated: 0,
    entries: [],
  };

  // Records one pushed entry's claim link in the response, minting a token for
  // the rare entry that lacks one.
  const recordEntry = async (
    externalId: string,
    entry: { id: string; claimToken: string | null },
  ): Promise<void> => {
    // The guarded write reports back which token actually landed, so a
    // concurrent mint can't leave this response carrying a dead claim URL.
    const token =
      entry.claimToken ??
      (await repos.deckCheck.setClaimTokenIfMissing(entry.id, generateShareToken()));
    result.entries.push({
      externalId,
      entryId: entry.id,
      claimUrl: token ? `${appBaseUrl}/tournaments/claim/${token}` : null,
    });
  };

  const touched = new Set<string>();
  for (const { entry, lines, contentHash, cardRows } of lists) {
    const identity = {
      playerName: entry.playerName,
      riotId: entry.riotId ?? null,
      submittedAt: entry.submittedAt ? new Date(entry.submittedAt) : null,
    };
    // An omitted consent flag is no statement: the stored value survives a
    // re-push, and a fresh insert falls back to the column default (true).
    const consent = {
      ...(entry.allowDeckPublishing === undefined
        ? {}
        : { allowDeckPublishing: entry.allowDeckPublishing }),
      ...(entry.allowNameSharing === undefined ? {} : { allowNameSharing: entry.allowNameSharing }),
      ...(entry.allowRiotIdSharing === undefined
        ? {}
        : { allowRiotIdSharing: entry.allowRiotIdSharing }),
    };

    const existing = await repos.deckCheck.getEntryByExternalId(event.id, entry.externalId);
    if (!existing) {
      // Each pushed entry creates its own walk-in participant; players link
      // themselves later through the claim link.
      const participant = await repos.tournaments.resolveOrCreateParticipant({
        tournamentId: event.id,
        riotId: identity.riotId,
        displayName: identity.playerName,
      });
      const created = await repos.deckCheck.createEntry({
        tournamentId: event.id,
        participantId: participant.id,
        externalId: entry.externalId,
        submittedAt: identity.submittedAt,
        ...consent,
        contentHash,
        state: entry.withdrawn ? "withdrawn" : "submitted",
        withdrawnAt: entry.withdrawn ? new Date() : null,
      });
      await repos.deckCheck.replaceEntryCards(created.id, cardRows);
      touched.add(participant.id);
      await recordEntry(entry.externalId, created);
      result.entriesCreated += 1;
      continue;
    }

    // A push without the withdrawn flag returns a withdrawn entry to
    // 'submitted'; it does not restore the pre-withdrawal state.
    const wasWithdrawn = existing.state === "withdrawn";
    if (existing.participantId !== null) {
      touched.add(existing.participantId);
    }
    const storedIdentity =
      existing.playerName === null ? { submittedAt: identity.submittedAt } : identity;
    const withdrawalChange = entry.withdrawn
      ? wasWithdrawn
        ? {}
        : {
            state: "withdrawn" as const,
            withdrawnAt: new Date(),
            unlockRequestedAt: null,
          }
      : wasWithdrawn
        ? { state: "submitted" as const, withdrawnAt: null }
        : {};
    if (entry.withdrawn && !wasWithdrawn) {
      result.entriesWithdrawn += 1;
    }

    if (existing.contentHash === contentHash) {
      // Identical list: refresh identity, consent, and withdrawal state, keep
      // the lifecycle state and every tick untouched (idempotent re-push).
      await repos.deckCheck.updateEntry(existing.id, {
        ...storedIdentity,
        ...consent,
        ...withdrawalChange,
      });
      await recordEntry(entry.externalId, existing);
      result.entriesUnchanged += 1;
      continue;
    }

    // The provider always wins: a changed list lands in 'submitted' from
    // any state, discarding an in-progress edit or pending unlock request.
    const previousCards = await repos.deckCheck.listCardsForEntry(existing.id);
    const wasReviewed = existing.state === "approved" || existing.state === "checked";
    await repos.deckCheck.updateEntry(existing.id, {
      ...storedIdentity,
      ...consent,
      contentHash,
      state: entry.withdrawn ? "withdrawn" : "submitted",
      withdrawnAt: entry.withdrawn ? (existing.withdrawnAt ?? new Date()) : null,
      reviewOutcome: null,
      checkedBy: null,
      checkedAt: null,
      approvedBy: null,
      approvedAt: null,
      unlockRequestedAt: null,
      preEditLines: null,
      changeSummary: wasReviewed ? diffCardLines(storedCardLines(previousCards), lines) : null,
    });
    await repos.deckCheck.replaceEntryCards(existing.id, cardRows);
    await recordEntry(entry.externalId, existing);
    if (wasReviewed) {
      result.checksInvalidated += 1;
    }
    result.entriesUpdated += 1;
  }

  if (touched.size > 0) {
    await repos.tournamentGroups.syncParticipantLegendsFromDeckCheck(event.id, [...touched]);
  }

  return result;
}

/**
 * Maps and resolves a judge-entered list. Runs before the write's
 * transaction, so the tournament lock is never held across a catalog cache load.
 */
export async function prepareManualDeckCheckList(
  repos: Repos,
  cards: { name: string; quantity: number; section: string }[],
): Promise<PreparedDeckCheckList> {
  const lines: DeckCheckCardLine[] = cards.map((card) => {
    const zone = mapSectionToZone(card.section);
    if (!zone) {
      throw new AppError(
        422,
        ERROR_CODES.VALIDATION_ERROR,
        `Unknown deck section: ${card.section}`,
      );
    }
    return { name: card.name, zone, quantity: card.quantity };
  });
  const resolutions = await resolveDeckCheckCards(
    repos,
    lines.map((line) => ({ name: line.name })),
  );
  return {
    lines,
    contentHash: sha256HexSync(buildContentHashInput(lines)),
    cardRows: toCardRows(cards, lines, resolutions),
  };
}

/**
 * External id is `manual:`-prefixed, so a later provider push for the same
 * player creates a separate entry.
 */
export async function createManualDeckCheckEntry(
  repos: Repos,
  tournamentId: string,
  participantId: string,
  list: PreparedDeckCheckList,
): Promise<DeckCheckEntry> {
  const created = await repos.deckCheck.createEntry({
    tournamentId,
    participantId,
    externalId: `${MANUAL_ENTRY_EXTERNAL_ID_PREFIX}${randomUUID()}`,
    submittedAt: null,
    contentHash: list.contentHash,
    withdrawnAt: null,
  });
  await repos.deckCheck.replaceEntryCards(created.id, list.cardRows);
  await syncDeckCheckLegend(repos, created);
  return created;
}
