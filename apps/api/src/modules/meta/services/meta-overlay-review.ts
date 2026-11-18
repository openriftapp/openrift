import { stringifyUnknown } from "@openrift/shared/strings";
import type {
  MetaOverlayBulkAcceptResult,
  MetaOverlayReviewResult,
  MetaUploadRevertResult,
  MetaUploadSummary,
} from "@openrift/shared/types/api/meta";
import type {
  MetaEntryStatus,
  MetaEventOverlayField,
  MetaListStatus,
  MetaPlayerOverlayField,
} from "@openrift/shared/types/enums";
import { META_EVENT_TIERS } from "@openrift/shared/types/enums";
import type { Insertable } from "kysely";

import type { MetaEventPlayerOverlaysTable } from "../../../db/tables/meta.js";
import type { Repos, Transact } from "../../../deps.js";
import { badRequest, conflict, notFound } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import { isoOrNull } from "../../../lib/iso-date.js";
import { TOURNAMENT_LIST_PROVIDER } from "../../../lib/meta-providers.js";
import type { OverlayLine } from "../lib/meta-overlay-lines.js";
import { toOverlayLines } from "../lib/meta-overlay-lines.js";
import type { MetaEventOverlayRow, MetaPlayerOverlayRow } from "../repositories/meta-overlays.js";
import { sourceEventKeyPrefix } from "../repositories/meta-overlays.js";
import type { MetaEventPlayerRow } from "../repositories/meta-players.js";
import type { MetaSubmissionRow } from "../repositories/meta-submissions.js";
import { splitSourcePlayerKey } from "./ingest-meta-overlays.js";
import type { MetaSubmissionResolutionDetails } from "./meta-overlay-ledger.js";
import {
  recordOverlayAcceptance,
  restoreEventCorrection,
  revokeEventCorrection,
  settleRejectedSubmissions,
} from "./meta-overlay-ledger.js";
import { promoteMetaEvent, promoteNewEvent } from "./meta-promote.js";
import { acceptCatalogEvent } from "./meta-sync/accept.js";

/** Compares the display form: the two sides type dates and numbers differently. */
function sameValue(left: unknown, right: unknown): boolean {
  if (left === null || left === undefined || right === null || right === undefined) {
    return (left ?? null) === (right ?? null);
  }
  return stringifyUnknown(left) === stringifyUnknown(right);
}

/**
 * A claim matching the live value would freeze it against future corrections.
 * `cards` is never dropped; `listStatus` stays claimed while `cards` is.
 */
function redundantClaims<F extends string>(
  claimedFields: readonly F[],
  overlay: Partial<Record<F, unknown>>,
  live: Partial<Record<F, unknown>>,
): F[] {
  return claimedFields.filter((field) => {
    if (field === "cards") {
      return false;
    }
    if (field === "listStatus" && claimedFields.some((claimed) => claimed === "cards")) {
      return false;
    }
    if (!Object.hasOwn(live, field)) {
      return false;
    }
    return sameValue(overlay[field], live[field]);
  });
}

export async function acceptMetaEventOverlay(
  transact: Transact,
  overlayId: string,
  intoMetaEventId: string | null = null,
  now: Date = new Date(),
  reviewedByUserId: string | null = null,
): Promise<MetaOverlayReviewResult> {
  return await transact((trx) =>
    // Read under the lock, so a concurrent accept of one proposal sees the event the first one minted.
    trx.meta.withPromoteLock(`event-overlay:${overlayId}`, async (repos) => {
      const overlay = await repos.metaOverlays.lockEventOverlay(overlayId);
      assertFound(overlay, "That overlay no longer exists.");
      if (overlay.status === "accepted") {
        throw conflict("That overlay was already accepted.");
      }
      const editedEventId = overlay.metaEventId;
      if (overlay.origin === "admin_edit" && editedEventId !== null) {
        await assertNoCurrentAdminEdit(
          repos,
          `admin-edit:${editedEventId}:${overlay.submittedByUserId}`,
          () => repos.metaOverlays.adminEditOverlay(editedEventId, overlay.submittedByUserId),
        );
      }

      if (overlay.metaEventId !== null) {
        await repos.metaOverlays.setEventOverlayStatus(overlayId, "accepted", now);
        await promoteMetaEvent(repos, overlay.metaEventId);
        await restoreEventCorrection(repos, overlay, reviewedByUserId, now);
        return { metaEventId: overlay.metaEventId, created: false };
      }

      if (intoMetaEventId !== null) {
        const target = await repos.meta.eventById(intoMetaEventId);
        assertFound(target, "That archived event no longer exists.");
        const redundant = redundantClaims(overlay.claimedFields, overlay, target);
        await repos.metaOverlays.updateEventOverlay(overlayId, {
          metaEventId: intoMetaEventId,
          status: "accepted",
          acceptedAt: now,
          claimedFields: overlay.claimedFields.filter((field) => !redundant.includes(field)),
          ...Object.fromEntries(redundant.map((field) => [field, null])),
        });
        await repos.metaOverlays.adoptProposedPlayers(overlayId, intoMetaEventId);
        await promoteMetaEvent(repos, intoMetaEventId);
        return { metaEventId: intoMetaEventId, created: false };
      }

      if (overlay.provider === TOURNAMENT_LIST_PROVIDER && overlay.externalId !== null) {
        return await acceptMirroredProposal(
          repos,
          overlay.id,
          overlay.externalId,
          overlay.format,
          now,
        );
      }

      // The check runs before anything is written: a failed validation must leave
      // the overlay pending, not accepted with no live event behind it.
      if (overlay.name === null || overlay.eventDate === null || overlay.format === null) {
        throw badRequest(
          "A proposed event needs a name, a date and a format before it can be accepted.",
        );
      }

      // Minted before the overlay is flipped: a failure here must leave the
      // proposal pending, not accepted with no live event behind it.
      const promoted = await promoteNewEvent(repos, overlay.provider, overlay.externalId, {
        name: overlay.name,
        eventDate: overlay.eventDate,
        format: overlay.format,
        sourceUrl: null,
      });

      await repos.metaOverlays.updateEventOverlay(overlayId, {
        metaEventId: promoted.metaEventId,
        status: "accepted",
        acceptedAt: now,
      });
      await repos.metaOverlays.adoptProposedPlayers(overlayId, promoted.metaEventId);
      await promoteMetaEvent(repos, promoted.metaEventId);

      return { metaEventId: promoted.metaEventId, created: promoted.created };
    }),
  );
}

/**
 * Accepted the way the catalogue accepts the UVS Games event, so the official
 * standings stay the source and the proposal claims nothing once the event is live.
 */
async function acceptMirroredProposal(
  repos: Repos,
  overlayId: string,
  uvsgamesEventId: string,
  format: string | null,
  now: Date,
): Promise<MetaOverlayReviewResult> {
  const row = await repos.uvsgamesEvents.byKey(uvsgamesEventId);
  assertFound(row, "That UVS Games event is not mirrored.");
  const accepted = await acceptCatalogEvent(
    { repos, now: () => now },
    row,
    format === null ? undefined : { format },
  );

  await repos.metaOverlays.updateEventOverlay(overlayId, {
    metaEventId: accepted.metaEventId,
    status: "accepted",
    acceptedAt: now,
    claimedFields: [],
    name: null,
    eventDate: null,
    format: null,
    playerCount: null,
    organizer: null,
    notes: null,
    tier: null,
    country: null,
    location: null,
  });
  await repos.metaOverlays.adoptProposedPlayers(overlayId, accepted.metaEventId);
  await anchorTournamentLists(repos, accepted.metaEventId, uvsgamesEventId);
  await promoteMetaEvent(repos, accepted.metaEventId);
  return { metaEventId: accepted.metaEventId, created: accepted.created };
}

async function anchorTournamentLists(
  repos: Repos,
  metaEventId: string,
  uvsgamesEventId: string,
): Promise<void> {
  const loose = await repos.metaOverlays.unanchoredPlayerOverlays(
    metaEventId,
    TOURNAMENT_LIST_PROVIDER,
  );
  if (loose.length === 0) {
    return;
  }
  const rows = await repos.meta.rawStandingsForEvent(metaEventId);
  const byIdentity = new Map(rows.map((row) => [row.sourceIdentity, row.id]));
  for (const overlay of loose) {
    const key = splitSourcePlayerKey(overlay.sourcePlayerKey);
    const identity = key.eventExternalId === uvsgamesEventId ? key.playerExternalId : null;
    const playerId = identity === null ? undefined : byIdentity.get(identity);
    if (playerId !== undefined) {
      await repos.metaOverlays.linkPlayerOverlay(overlay.id, playerId);
    }
  }
}

export async function moveMetaEventOverlay(
  transact: Transact,
  overlayId: string,
  intoMetaEventId: string,
): Promise<MetaOverlayReviewResult> {
  return await transact(async (repos) => {
    const overlay = await repos.metaOverlays.lockEventOverlay(overlayId);
    assertFound(overlay, "That overlay no longer exists.");
    if (overlay.provider === null || overlay.externalId === null) {
      throw badRequest(
        "Only a provider's upload can be moved; a person's overlay is a correction to one event.",
      );
    }
    if (overlay.metaEventId === intoMetaEventId) {
      return { metaEventId: intoMetaEventId, created: false };
    }
    const target = await repos.meta.eventById(intoMetaEventId);
    assertFound(target, "That archived event no longer exists.");

    const leaving = overlay.metaEventId;
    await repos.metaOverlays.reanchorPlayerOverlays(
      overlay.provider,
      overlay.externalId,
      intoMetaEventId,
    );
    await repos.metaOverlays.updateEventOverlay(overlayId, { metaEventId: intoMetaEventId });
    for (const metaEventId of [leaving, intoMetaEventId].filter((id) => id !== null).toSorted()) {
      await promoteMetaEvent(repos, metaEventId);
    }
    return { metaEventId: intoMetaEventId, created: false };
  });
}

export async function listMetaUploadsForEvent(
  repos: Repos,
  metaEventId: string,
): Promise<MetaUploadSummary[]> {
  const overlays = await repos.metaOverlays.pushOverlaysForEvent(metaEventId);
  const allPlayers = await repos.metaOverlays.playerOverlaysForSourceEvents(overlays);
  const accepted = allPlayers.filter((player) => player.status === "accepted");
  const minted = await repos.meta.mintedPlayerCounts(accepted.map((player) => player.id));
  return overlays.map((overlay) => {
    const prefix = sourceEventKeyPrefix(overlay.externalId);
    const players = allPlayers.filter(
      (player) =>
        player.provider === overlay.provider && player.sourcePlayerKey?.startsWith(prefix) === true,
    );
    return {
      eventOverlayId: overlay.id,
      provider: overlay.provider,
      externalId: overlay.externalId,
      status: overlay.status,
      acceptedAt: isoOrNull(overlay.acceptedAt),
      acceptedPlayers: players.filter((player) => player.status === "accepted").length,
      pendingPlayers: players.filter((player) => player.status === "pending").length,
      mintedPlayers: players.reduce((sum, player) => sum + (minted.get(player.id) ?? 0), 0),
    };
  });
}

/**
 * Rejects one upload whole, event overlay and every standings overlay it
 * wrote. Nothing is deleted, so a corrected file can be accepted again.
 */
export async function revertMetaUpload(
  transact: Transact,
  provider: string,
  eventExternalId: string,
  now: Date = new Date(),
): Promise<MetaUploadRevertResult> {
  return await transact(async (repos) => {
    const [found] = await repos.metaOverlays.eventOverlaysBySourceKeys(provider, [eventExternalId]);
    const eventOverlay =
      found === undefined ? undefined : await repos.metaOverlays.lockEventOverlay(found.id);
    const listed = await repos.metaOverlays.playerOverlaysForSourceEvents([
      { provider, externalId: eventExternalId },
    ]);
    const players = await repos.metaOverlays.lockPlayerOverlays(listed.map((player) => player.id));
    if (eventOverlay === undefined && players.length === 0) {
      throw notFound("No upload with that source key exists.");
    }

    const eventIds = await repos.metaOverlays.eventIdsForPlayerOverlays(
      players.map((player) => player.id),
    );
    const affected = new Set<string>();
    for (const metaEventId of eventIds.values()) {
      if (metaEventId !== null) {
        affected.add(metaEventId);
      }
    }
    if (eventOverlay !== undefined && eventOverlay.metaEventId !== null) {
      affected.add(eventOverlay.metaEventId);
    }

    const settled = players.filter((player) => player.status !== "rejected");
    const eventRejected = eventOverlay !== undefined && eventOverlay.status !== "rejected";
    if (settled.length === 0 && !eventRejected) {
      throw conflict("That upload is already reverted.");
    }
    await settleRejectedSubmissions(repos, settled, eventIds, {}, now);
    await repos.metaOverlays.setPlayerOverlayStatuses(
      settled.map((player) => player.id),
      "rejected",
      now,
    );
    if (eventRejected) {
      await repos.metaOverlays.setEventOverlayStatus(eventOverlay.id, "rejected", now);
    }

    for (const metaEventId of [...affected].toSorted()) {
      await promoteMetaEvent(repos, metaEventId);
    }

    return { metaEventIds: [...affected], players: settled.length, eventRejected };
  });
}

export interface MetaEventFieldEdit {
  field: MetaEventOverlayField;
  value: string | null;
}

/**
 * One admin's edits merge into a single row per author. `acceptedAt` moves to
 * now on each merge, so the latest edit outranks overlays accepted between.
 */
export async function writeEventOverlayFields(
  transact: Transact,
  metaEventId: string,
  edits: readonly MetaEventFieldEdit[],
  authorUserId: string,
  now: Date = new Date(),
): Promise<MetaOverlayReviewResult> {
  return await transact(async (repos) => {
    const live = await repos.meta.eventById(metaEventId);
    assertFound(live, "That archived event no longer exists.");
    if (edits.length === 0) {
      return { metaEventId, created: false };
    }

    const columns: Record<string, unknown> = {};
    for (const edit of edits) {
      Object.assign(columns, coerceEventField(edit.field, edit.value));
    }
    const fields = [...new Set(edits.map((edit) => edit.field))];

    await repos.meta.withPromoteLock(`admin-edit:${metaEventId}:${authorUserId}`, async () => {
      const existing = await repos.metaOverlays.adminEditOverlay(metaEventId, authorUserId);
      await (existing === undefined
        ? repos.metaOverlays.insertEventOverlay({
            metaEventId,
            claimedFields: fields,
            origin: "admin_edit",
            status: "accepted",
            acceptedAt: now,
            submittedByUserId: authorUserId,
            ...columns,
          })
        : repos.metaOverlays.updateEventOverlay(existing.id, {
            claimedFields: [...new Set([...existing.claimedFields, ...fields])],
            acceptedAt: now,
            ...columns,
          }));
    });
    await promoteMetaEvent(repos, metaEventId);
    return { metaEventId, created: false };
  });
}

/**
 * Applies a pending event correction as the submitter's own accepted overlay,
 * then settles the ledger row and the event credit. `fields` narrows the
 * proposal; null takes all of it.
 */
export async function applyMetaEventCorrection(
  transact: Transact,
  submissionId: string,
  options: { fields: readonly MetaEventOverlayField[] | null; reviewedByUserId: string },
  now: Date = new Date(),
): Promise<MetaOverlayReviewResult> {
  const metaEventId = await transact(async (trx) => {
    const found = await trx.metaSubmissions.byId(submissionId);
    assertFound(found, "Submission not found");
    // Serializes a concurrent apply of the same correction behind this commit.
    await trx.ingest.lockCardAndMetaSubmissions(found.userId);
    const submission = (await trx.metaSubmissions.byId(submissionId)) ?? found;
    if (submission.kind !== "event_correction") {
      throw badRequest("That submission is not an event correction.");
    }
    if (submission.status !== "pending") {
      throw conflict("That correction is already settled.");
    }
    const eventId = submission.metaEventId;
    const live = eventId === null ? undefined : await trx.meta.eventById(eventId);
    if (eventId === null || live === undefined) {
      throw conflict("The event this correction is about is gone.");
    }

    const proposed = Object.entries(submission.fieldEdits ?? {}).filter(
      ([field, value]) =>
        value !== undefined &&
        (options.fields === null || options.fields.includes(field as MetaEventOverlayField)),
    ) as [MetaEventOverlayField, string | number][];
    const columns: Record<string, unknown> = {};
    for (const [field, value] of proposed) {
      const text = field === "country" ? String(value).toUpperCase() : String(value);
      Object.assign(columns, coerceEventField(field, text));
    }
    const offered = proposed.map(([field]) => field);
    const redundant = redundantClaims(offered, columns, live);
    const claimedFields = offered.filter((field) => !redundant.includes(field));
    if (claimedFields.length === 0) {
      throw badRequest(
        "The event already shows these values. Resolve it as already in the archive.",
      );
    }

    const eventOverlayId = await trx.metaOverlays.insertEventOverlay({
      metaEventId: eventId,
      claimedFields,
      origin: "contributor",
      status: "accepted",
      acceptedAt: now,
      submittedByUserId: submission.userId,
      submissionNote: submission.note,
      ...Object.fromEntries(claimedFields.map((field) => [field, columns[field]])),
    });
    await trx.metaSubmissions.recordAcceptance({
      submissionId,
      credit: { metaEventId: eventId, metaEventPlayerId: null, userId: submission.userId },
      acceptedDeckId: null,
      resolvedAt: now,
      resolvedByUserId: options.reviewedByUserId,
      eventOverlayId,
    });
    await promoteMetaEvent(trx, eventId);
    return eventId;
  });
  return { metaEventId, created: false };
}

/**
 * An admin-edit row whose last claim goes is deleted. A submission's claim
 * list must stay non-empty by CHECK, so releasing its last claim rejects it.
 */
export async function releaseEventOverlayField(
  transact: Transact,
  metaEventId: string,
  field: MetaEventOverlayField,
  reviewedByUserId: string | null = null,
  now: Date = new Date(),
): Promise<MetaOverlayReviewResult> {
  return await transact(async (repos) => {
    const live = await repos.meta.eventById(metaEventId);
    assertFound(live, "That archived event no longer exists.");

    const accepted = await repos.metaOverlays.acceptedEventOverlays(metaEventId);
    const claiming = accepted
      .filter((overlay) => overlay.claimedFields.includes(field))
      .map((overlay) => overlay.id)
      .toSorted();
    const overlays: MetaEventOverlayRow[] = [];
    for (const id of claiming) {
      const locked = await repos.metaOverlays.lockEventOverlay(id);
      if (locked?.status === "accepted" && locked.claimedFields.includes(field)) {
        overlays.push(locked);
      }
    }
    const adminEdits = await repos.metaOverlays.adminEditEventOverlayIds(
      overlays.map((overlay) => overlay.id),
    );
    for (const overlay of overlays) {
      const remaining = overlay.claimedFields.filter((claimed) => claimed !== field);
      if (remaining.length === 0 && adminEdits.has(overlay.id)) {
        await repos.metaOverlays.deleteEventOverlay(overlay.id);
        continue;
      }
      if (remaining.length === 0) {
        await revokeEventCorrection(repos, overlay, { resolvedByUserId: reviewedByUserId }, now);
        await repos.metaOverlays.setEventOverlayStatus(overlay.id, "rejected", now);
        continue;
      }
      await repos.metaOverlays.updateEventOverlay(overlay.id, {
        claimedFields: remaining,
        [field]: null,
      });
    }

    await promoteMetaEvent(repos, metaEventId);
    return { metaEventId, created: false };
  });
}

function coerceEventField(
  field: MetaEventOverlayField,
  value: string | null,
): Record<string, unknown> {
  const trimmed = value === null ? null : value.trim();
  const empty = trimmed === null || trimmed === "";

  if (field === "playerCount") {
    if (empty) {
      return { playerCount: null };
    }
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw badRequest("Player count must be a positive whole number.");
    }
    return { playerCount: parsed };
  }

  if (field === "tier") {
    if (empty || !(META_EVENT_TIERS as readonly string[]).includes(trimmed)) {
      throw badRequest(`Tier must be one of ${META_EVENT_TIERS.join(", ")}.`);
    }
    return { tier: trimmed };
  }

  if (field === "eventDate") {
    if (empty || !/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) {
      throw badRequest("The date must be YYYY-MM-DD.");
    }
    return { eventDate: trimmed };
  }

  // name and format have a NOT NULL constraint on the live row.
  if ((field === "name" || field === "format") && empty) {
    throw badRequest(`An event must keep its ${field}.`);
  }

  return { [field]: empty ? null : trimmed };
}

export interface MetaPlayerFieldEdits {
  playerName?: string | null;
  rank?: number;
  rankIsTier?: boolean;
  wins?: number | null;
  losses?: number | null;
  draws?: number | null;
  matchPoints?: number | null;
  opponentMatchWinPct?: number | null;
  gameWinPct?: number | null;
  opponentGameWinPct?: number | null;
  entryStatus?: MetaEntryStatus | null;
  legendCardId?: string | null;
  championCardId?: string | null;
}

export interface MetaPlayerOverlayList {
  name?: string;
  cards: { cardId: string; zone: string; quantity: number; preferredPrintingId?: string | null }[];
  listStatus: Exclude<MetaListStatus, "none">;
}

const PLAYER_SCALAR_FIELDS = [
  "playerName",
  "rank",
  "rankIsTier",
  "wins",
  "losses",
  "draws",
  "matchPoints",
  "opponentMatchWinPct",
  "gameWinPct",
  "opponentGameWinPct",
  "entryStatus",
  "legendCardId",
  "championCardId",
] as const satisfies readonly MetaPlayerOverlayField[];

/**
 * A list's `name` renames the deck after promote; promotion leaves deck
 * names alone otherwise.
 */
export async function writeMetaPlayerOverlayFields(
  transact: Transact,
  metaEventPlayerId: string,
  edits: { fields?: MetaPlayerFieldEdits; list?: MetaPlayerOverlayList | null },
  authorUserId: string,
  now: Date = new Date(),
): Promise<MetaOverlayReviewResult> {
  return await transact(async (repos) => {
    const metaEventId = await repos.meta.eventIdForPlayer(metaEventPlayerId);
    assertFound(metaEventId, "That standings row no longer exists.");

    const fields = edits.fields ?? {};
    const claimedScalars = PLAYER_SCALAR_FIELDS.filter((field) => Object.hasOwn(fields, field));
    const claimed: MetaPlayerOverlayField[] = [...claimedScalars];
    const columns: Record<string, unknown> = Object.fromEntries(
      claimedScalars.map((field) => [field, fields[field]]),
    );

    if (fields.playerName === null) {
      const rows = await repos.meta.rawStandingsForEvent(metaEventId);
      const row = rows.find((candidate) => candidate.id === metaEventPlayerId);
      if (row?.uvsgamesPlayerId === null) {
        throw badRequest("This entry has no source name to fall back to, so it must keep a name.");
      }
    }

    let lines: OverlayLine[] | undefined;
    if (edits.list !== undefined) {
      claimed.push("cards", "listStatus");
      columns.listStatus = edits.list === null ? "none" : edits.list.listStatus;
      lines =
        edits.list === null
          ? []
          : await toOverlayLines(repos, await listCards(repos, metaEventPlayerId, edits.list));
    }

    if (claimed.length === 0) {
      return { metaEventId, created: false };
    }

    await repos.meta.withPromoteLock(
      `admin-player-edit:${metaEventPlayerId}:${authorUserId}`,
      async () => {
        const existing = await repos.metaOverlays.adminPlayerEditOverlay(
          metaEventPlayerId,
          authorUserId,
        );
        await (existing === undefined
          ? repos.metaOverlays.insertPlayerOverlay(
              {
                metaEventPlayerId,
                metaEventId: null,
                eventOverlayId: null,
                claimedFields: claimed,
                origin: "admin_edit",
                status: "accepted",
                acceptedAt: now,
                submittedByUserId: authorUserId,
                ...columns,
              } as Insertable<MetaEventPlayerOverlaysTable>,
              lines ?? [],
            )
          : repos.metaOverlays.updatePlayerOverlay(
              existing.id,
              {
                claimedFields: [...new Set([...existing.claimedFields, ...claimed])],
                acceptedAt: now,
                ...columns,
              },
              lines,
            ));
      },
    );

    await promoteMetaEvent(repos, metaEventId);
    if (edits.list !== null && edits.list?.name !== undefined) {
      // After the promote, so a freshly claimed list has its deck to rename.
      await repos.meta.renamePlayerDeck(metaEventPlayerId, edits.list.name);
    }
    return { metaEventId, created: false };
  });
}

/** A list with no cards changes only the status, so it claims the live deck as it stands. */
async function listCards(
  repos: Repos,
  metaEventPlayerId: string,
  list: MetaPlayerOverlayList,
): Promise<MetaPlayerOverlayList["cards"]> {
  if (list.cards.length > 0) {
    return list.cards;
  }
  const stored = await repos.meta.playerDeckCards(metaEventPlayerId);
  if (stored.length === 0) {
    throw badRequest(
      "This entry has no stored list. Paste one to set whether it is full or partial.",
    );
  }
  return stored;
}

/**
 * `cards` and `listStatus` release together: a list and its status can never
 * disagree.
 */
export async function releaseMetaPlayerOverlayField(
  transact: Transact,
  metaEventPlayerId: string,
  field: MetaPlayerOverlayField,
  reviewedByUserId: string | null = null,
  now: Date = new Date(),
): Promise<MetaOverlayReviewResult> {
  return await transact(async (repos) => {
    const metaEventId = await repos.meta.eventIdForPlayer(metaEventPlayerId);
    assertFound(metaEventId, "That standings row no longer exists.");

    const released: MetaPlayerOverlayField[] =
      field === "cards" || field === "listStatus" ? ["cards", "listStatus"] : [field];
    const claimsReleased = (overlay: MetaPlayerOverlayRow): boolean =>
      overlay.status === "accepted" &&
      overlay.metaEventPlayerId === metaEventPlayerId &&
      overlay.claimedFields.some((claim) => released.includes(claim));
    const accepted = await repos.metaOverlays.acceptedPlayerOverlays(metaEventId);
    const locked = await repos.metaOverlays.lockPlayerOverlays(
      accepted.filter((overlay) => claimsReleased(overlay)).map((overlay) => overlay.id),
    );
    const overlays = locked.filter((overlay) => claimsReleased(overlay));
    const adminEdits = await repos.metaOverlays.adminEditPlayerOverlayIds(
      overlays.map((overlay) => overlay.id),
    );
    const emptied = overlays.filter(
      (overlay) =>
        !adminEdits.has(overlay.id) &&
        overlay.claimedFields.every((claim) => released.includes(claim)),
    );
    await settleRejectedSubmissions(
      repos,
      emptied,
      new Map(emptied.map((overlay) => [overlay.id, metaEventId])),
      { resolvedByUserId: reviewedByUserId },
      now,
    );
    if (emptied.length > 0) {
      await repos.metaOverlays.setPlayerOverlayStatuses(
        emptied.map((overlay) => overlay.id),
        "rejected",
        now,
      );
    }

    for (const overlay of overlays) {
      const remaining = overlay.claimedFields.filter((claim) => !released.includes(claim));
      const isAdminEdit = adminEdits.has(overlay.id);
      if (remaining.length === 0) {
        if (isAdminEdit) {
          await repos.metaOverlays.deletePlayerOverlay(overlay.id);
        }
        continue;
      }
      const cleared = Object.fromEntries(
        released.filter((claim) => claim !== "cards").map((claim) => [claim, null]),
      );
      await repos.metaOverlays.updatePlayerOverlay(
        overlay.id,
        { claimedFields: remaining, ...cleared },
        released.includes("cards") && isAdminEdit ? [] : undefined,
      );
    }

    await promoteMetaEvent(repos, metaEventId);
    return { metaEventId, created: false };
  });
}

interface PendingPlayerAccept {
  overlay: MetaPlayerOverlayRow;
  player: MetaEventPlayerRow | null;
  metaEventId: string;
  fields?: MetaPlayerOverlayField[] | null;
}

/** The submissions an accept moved to accepted: the ones whose contributor is owed a thank-you. */
export type MetaOverlayAcceptOutcome<T> = T & { acceptedSubmissions: MetaSubmissionRow[] };

/** Holds the rows until the accept commits, so a second accept of one row waits and then refuses. */
async function lockForTransition(
  repos: Repos,
  overlayIds: readonly string[],
  target: "accepted" | "rejected",
): Promise<MetaPlayerOverlayRow[]> {
  const locked = await repos.metaOverlays.lockPlayerOverlays(overlayIds);
  if (locked.length !== new Set(overlayIds).size) {
    throw notFound("That overlay no longer exists.");
  }
  if (locked.some((overlay) => overlay.status === target)) {
    throw conflict(`That entry was already ${target}.`);
  }
  return locked;
}

async function loadPlayerAccept(
  repos: Repos,
  overlayId: string,
  metaEventPlayerId: string | null,
): Promise<PendingPlayerAccept> {
  const overlay = await repos.metaOverlays.playerOverlayById(overlayId);
  assertFound(overlay, "That overlay no longer exists.");
  let player: MetaEventPlayerRow | null = null;
  let metaEventId = await eventIdForPlayerOverlay(repos, overlay);
  if (metaEventPlayerId !== null) {
    player = (await repos.meta.playerById(metaEventPlayerId)) ?? null;
    assertFound(player, "That standings row no longer exists.");
    metaEventId = (await repos.meta.eventIdForPlayer(metaEventPlayerId)) ?? metaEventId;
  }
  if (metaEventId === null) {
    throw conflict(
      "This entry belongs to an event that has not been accepted yet. Accept the event first.",
    );
  }
  const targetPlayerId = player?.id ?? overlay.metaEventPlayerId;
  if (overlay.origin === "admin_edit" && targetPlayerId !== null) {
    await assertNoCurrentAdminEdit(
      repos,
      `admin-player-edit:${targetPlayerId}:${overlay.submittedByUserId}`,
      () => repos.metaOverlays.adminPlayerEditOverlay(targetPlayerId, overlay.submittedByUserId),
    );
  }
  return { overlay, player, metaEventId };
}

/**
 * An admin keeps one accepted edit row per target, so a rejected one cannot
 * come back while a newer one holds the target. The lock is the one the edit writers take.
 */
async function assertNoCurrentAdminEdit(
  repos: Repos,
  key: string,
  current: () => Promise<unknown>,
): Promise<void> {
  await repos.meta.withPromoteLock(key, async () => {
    if ((await current()) !== undefined) {
      throw conflict(
        "This admin edit was replaced by a newer one on the same entry. Edit the field again instead.",
      );
    }
  });
}

/**
 * Callers must narrow using the returned claims, not the overlay's original
 * ones, or narrowing reclaims a field this just nulled.
 */
async function anchorPlayerOverlay(
  repos: Repos,
  overlay: MetaPlayerOverlayRow,
  player: MetaEventPlayerRow,
): Promise<MetaPlayerOverlayField[]> {
  await repos.metaOverlays.linkPlayerOverlay(overlay.id, player.id);
  const redundant = redundantClaims(overlay.claimedFields, overlay, player);
  if (redundant.length === 0) {
    return [...overlay.claimedFields];
  }
  const remaining = overlay.claimedFields.filter((field) => !redundant.includes(field));
  await repos.metaOverlays.updatePlayerOverlay(overlay.id, {
    claimedFields: remaining,
    ...Object.fromEntries(redundant.map((field) => [field, null])),
  });
  return remaining;
}

/**
 * Drops claims an accept was told to leave behind. The card rows survive a
 * dropped `cards` claim; clearing them would read as a change on re-upload.
 */
async function narrowPlayerClaims(
  repos: Repos,
  overlayId: string,
  claimed: readonly MetaPlayerOverlayField[],
  fields: readonly MetaPlayerOverlayField[] | null,
): Promise<void> {
  if (fields === null) {
    return;
  }
  const kept = new Set<MetaPlayerOverlayField>(fields);
  if (kept.has("cards") || kept.has("listStatus")) {
    kept.add("cards");
    kept.add("listStatus");
  }
  const remaining = claimed.filter((claim) => kept.has(claim));
  // claimed.length === 0 means the anchor already dropped every claim as
  // redundant: a finished accept, not an empty mask.
  if (remaining.length === 0 && claimed.length > 0) {
    throw badRequest("An accept that keeps no claim is a reject. Reject the row instead.");
  }
  if (remaining.length === claimed.length) {
    return;
  }
  const cleared = Object.fromEntries(
    claimed.filter((claim) => !kept.has(claim) && claim !== "cards").map((claim) => [claim, null]),
  );
  await repos.metaOverlays.updatePlayerOverlay(overlayId, {
    claimedFields: remaining,
    ...cleared,
  });
}

export async function acceptMetaPlayerOverlay(
  transact: Transact,
  overlayId: string,
  options: {
    metaEventPlayerId?: string | null;
    fields?: MetaPlayerOverlayField[] | null;
    reviewedByUserId?: string | null;
  } = {},
  now: Date = new Date(),
): Promise<MetaOverlayAcceptOutcome<MetaOverlayReviewResult>> {
  return await transact(async (repos) => {
    await lockForTransition(repos, [overlayId], "accepted");
    const { overlay, player, metaEventId } = await loadPlayerAccept(
      repos,
      overlayId,
      options.metaEventPlayerId ?? null,
    );
    const claimed =
      player === null
        ? [...overlay.claimedFields]
        : await anchorPlayerOverlay(repos, overlay, player);
    await narrowPlayerClaims(repos, overlayId, claimed, options.fields ?? null);
    await repos.metaOverlays.setPlayerOverlayStatuses([overlayId], "accepted", now);
    await promoteMetaEvent(repos, metaEventId);
    const submission = await recordOverlayAcceptance(
      repos,
      overlayId,
      metaEventId,
      options.reviewedByUserId ?? null,
      now,
    );
    return {
      metaEventId,
      created: false,
      acceptedSubmissions: submission === null ? [] : [submission],
    };
  });
}

/**
 * Every item is resolved before anything is written, so a stale id refuses
 * the whole batch, and each touched event is promoted once at the end.
 */
export async function acceptMetaPlayerOverlays(
  transact: Transact,
  items: readonly {
    id: string;
    metaEventPlayerId: string | null;
    fields?: MetaPlayerOverlayField[] | null;
  }[],
  reviewedByUserId: string | null = null,
  now: Date = new Date(),
): Promise<MetaOverlayAcceptOutcome<MetaOverlayBulkAcceptResult>> {
  return await transact(async (repos) => {
    await lockForTransition(
      repos,
      items.map((item) => item.id),
      "accepted",
    );
    const pending: PendingPlayerAccept[] = [];
    for (const item of items) {
      pending.push({
        ...(await loadPlayerAccept(repos, item.id, item.metaEventPlayerId)),
        fields: item.fields ?? null,
      });
    }
    const adminEditTargets = pending
      .filter(({ overlay }) => overlay.origin === "admin_edit")
      .map(
        ({ overlay, player }) =>
          `${player?.id ?? overlay.metaEventPlayerId}:${overlay.submittedByUserId}`,
      );
    if (new Set(adminEditTargets).size !== adminEditTargets.length) {
      throw conflict("Two of these admin edits are by one admin on the same entry. Accept one.");
    }
    for (const { overlay, player, fields } of pending) {
      const claimed =
        player === null
          ? [...overlay.claimedFields]
          : await anchorPlayerOverlay(repos, overlay, player);
      await narrowPlayerClaims(repos, overlay.id, claimed, fields ?? null);
      await repos.metaOverlays.setPlayerOverlayStatuses([overlay.id], "accepted", now);
    }
    const metaEventIds = [...new Set(pending.map((entry) => entry.metaEventId))];
    for (const metaEventId of metaEventIds.toSorted()) {
      await promoteMetaEvent(repos, metaEventId);
    }
    const acceptedSubmissions: MetaSubmissionRow[] = [];
    for (const { overlay, metaEventId } of pending) {
      const submission = await recordOverlayAcceptance(
        repos,
        overlay.id,
        metaEventId,
        reviewedByUserId,
        now,
      );
      if (submission !== null) {
        acceptedSubmissions.push(submission);
      }
    }
    return { accepted: pending.length, metaEventIds, acceptedSubmissions };
  });
}

/**
 * Anchors a standings overlay to the live row it describes, then promotes so
 * an already-accepted overlay lands immediately.
 */
export async function linkMetaPlayerOverlay(
  transact: Transact,
  overlayId: string,
  metaEventPlayerId: string,
): Promise<MetaOverlayReviewResult> {
  return await transact(async (repos) => {
    const [overlay] = await repos.metaOverlays.lockPlayerOverlays([overlayId]);
    assertFound(overlay, "That overlay no longer exists.");
    const player = await repos.meta.playerById(metaEventPlayerId);
    assertFound(player, "That standings row no longer exists.");

    await anchorPlayerOverlay(repos, overlay, player);
    const metaEventId = await repos.meta.eventIdForPlayer(metaEventPlayerId);
    if (overlay.status === "accepted" && metaEventId !== undefined) {
      await promoteMetaEvent(repos, metaEventId);
    }
    return { metaEventId: metaEventId ?? null, created: false };
  });
}

/**
 * Maps an unmatched card name on every queued line, then re-promotes the
 * events whose accepted lists that completes: a list stays off the live row
 * until all of its lines resolve.
 */
export async function resolveMetaCardName(
  transact: Transact,
  cardName: string,
  cardId: string,
): Promise<{ updated: number; metaEventIds: string[] }> {
  return await transact(async (repos) => {
    const { updated, overlayIds } = await repos.metaOverlays.resolveCardName(cardName, cardId);
    const eventIds = await repos.metaOverlays.eventIdsForPlayerOverlays(overlayIds, {
      acceptedOnly: true,
    });
    const metaEventIds = [...new Set(eventIds.values())].filter((id) => id !== null).toSorted();
    for (const metaEventId of metaEventIds) {
      await promoteMetaEvent(repos, metaEventId);
    }
    return { updated, metaEventIds };
  });
}

/**
 * Promotion runs afterward only if the overlay had been applied:
 * un-accepting a patch must put the promoted value back, which a re-promote does.
 */
export async function rejectMetaOverlay(
  transact: Transact,
  target: { kind: "event" | "player"; id: string },
  resolution: MetaSubmissionResolutionDetails = {},
  now: Date = new Date(),
): Promise<MetaOverlayReviewResult> {
  return await transact(async (repos) => {
    if (target.kind === "event") {
      const overlay = await repos.metaOverlays.lockEventOverlay(target.id);
      assertFound(overlay, "That overlay no longer exists.");
      if (overlay.status === "rejected") {
        throw conflict("That overlay was already rejected.");
      }
      await revokeEventCorrection(repos, overlay, resolution, now);
      await repos.metaOverlays.setEventOverlayStatus(target.id, "rejected", now);
      if (overlay.status === "accepted" && overlay.metaEventId !== null) {
        await promoteMetaEvent(repos, overlay.metaEventId);
      }
      return { metaEventId: overlay.metaEventId, created: false };
    }

    const [overlay] = await lockForTransition(repos, [target.id], "rejected");
    assertFound(overlay, "That overlay no longer exists.");
    const metaEventId = await eventIdForPlayerOverlay(repos, overlay);
    await settleRejectedSubmissions(
      repos,
      [overlay],
      new Map([[overlay.id, metaEventId]]),
      resolution,
      now,
    );
    await repos.metaOverlays.setPlayerOverlayStatuses([target.id], "rejected", now);
    if (overlay.status === "accepted" && metaEventId !== null) {
      await promoteMetaEvent(repos, metaEventId);
    }
    return { metaEventId, created: false };
  });
}

async function eventIdForPlayerOverlay(
  repos: Repos,
  overlay: {
    metaEventId: string | null;
    metaEventPlayerId: string | null;
    eventOverlayId: string | null;
  },
): Promise<string | null> {
  if (overlay.metaEventId !== null) {
    return overlay.metaEventId;
  }
  if (overlay.metaEventPlayerId !== null) {
    return (await repos.meta.eventIdForPlayer(overlay.metaEventPlayerId)) ?? null;
  }
  if (overlay.eventOverlayId !== null) {
    const parent = await repos.metaOverlays.eventOverlayById(overlay.eventOverlayId);
    return parent?.metaEventId ?? null;
  }
  return null;
}
