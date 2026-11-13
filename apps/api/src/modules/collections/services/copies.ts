import { MAX_COPIES_PER_REQUEST } from "@openrift/shared/contracts/copies";
import type { TradeCancelConflictData } from "@openrift/shared/contracts/fields";
import { normalizeCopyMetadataPatch } from "@openrift/shared/copy-metadata";
import { createLogger } from "@openrift/shared/logger";
import type { CopyLink, CopyMetadataPatch } from "@openrift/shared/types/api/collection";

import type { Repos, Transact } from "../../../deps.js";
import { conflict, forbidden, notFound } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import { ensureInbox } from "../../groups/services/inbox.js";
import type { TradeCancelConsent } from "../../groups/services/trade-supply.js";
import { previewTradeCancels, sweepGiverPrintings } from "../../groups/services/trade-supply.js";
import { logEvents } from "../../system/services/event-logger.js";
import { loadWritableCopies } from "../lib/collection-access.js";

const log = createLogger("copies");

interface AddCopyInput {
  id?: string;
  printingId: string;
  collectionId?: string;
  condition?: string | null;
  grader?: string | null;
  grade?: number | null;
  notesPublic?: string | null;
  notesPrivate?: string | null;
  isAltered?: boolean;
  links?: CopyLink[];
}

interface AddCopyResult {
  id: string;
  printingId: string;
  collectionId: string;
  /** Owning group of the copy's collection; null for personal collections. */
  groupId: string | null;
  condition: string | null;
  grader: string | null;
  grade: number | null;
  notesPublic: string | null;
  notesPrivate: string | null;
  isAltered: boolean;
  links: CopyLink[];
  /** Always false for a just-created copy. */
  onLoan: boolean;
  /** Always false for a just-created copy: not yet reserved. */
  reserved: boolean;
}

export async function addCopies(
  repos: Repos,
  transact: Transact,
  userId: string,
  copies: AddCopyInput[],
  options?: { batchId?: string },
): Promise<AddCopyResult[]> {
  const inboxId = await ensureInbox(repos, userId);

  const explicitIds = [...new Set(copies.map((c) => c.collectionId).filter(Boolean))] as string[];
  if (explicitIds.length > 0) {
    const writable = await repos.collections.filterWritableByViewer(explicitIds, userId);
    if (writable.length !== explicitIds.length) {
      throw forbidden("One or more collections are not writable by you");
    }
  }

  const outcome = await transact(async (trxRepos) => {
    // Copies carry no owner column — ownership derives from the collection.
    // The acting `userId` is recorded only as the event actor below.
    const copyValues = copies.map((item) => ({
      id: item.id,
      printingId: item.printingId,
      collectionId: item.collectionId ?? inboxId,
      condition: item.condition ?? null,
      grader: item.grader ?? null,
      grade: item.grade ?? null,
      notesPublic: item.notesPublic ?? null,
      notesPrivate: item.notesPrivate ?? null,
      isAltered: item.isAltered ?? false,
      links: item.links ?? undefined,
    }));

    const insertedRows = await trxRepos.copies.insertBatch(copyValues);
    const insertedById = new Map(insertedRows.map((row) => [row.id, row]));

    const suppliedIds = copies.map((item) => item.id).filter((id) => id !== undefined);
    const missingIds = suppliedIds.filter((id) => !insertedById.has(id));
    const replayedRows = await trxRepos.copies.listByIdsInCollections(missingIds, [
      ...new Set([...explicitIds, inboxId]),
    ]);
    const replayedById = new Map(replayedRows.map((row) => [row.id, row]));

    const supplied = new Set(suppliedIds);
    const generated = insertedRows.filter((row) => !supplied.has(row.id));
    let generatedIndex = 0;
    const rows = copies.map((item) => {
      if (item.id === undefined) {
        const row = generated[generatedIndex];
        generatedIndex += 1;
        assertFound(row, "Copy was not created");
        return row;
      }
      const inserted = insertedById.get(item.id);
      if (inserted) {
        return inserted;
      }
      const replayed = replayedById.get(item.id);
      const sameCopy =
        replayed !== undefined &&
        replayed.collectionId === (item.collectionId ?? inboxId) &&
        replayed.printingId === item.printingId;
      if (!sameCopy) {
        throw conflict("One or more copy ids are already taken");
      }
      return replayed;
    });

    const collectionIds = [...new Set(rows.map((row) => row.collectionId))];
    const collectionRows = await trxRepos.collections.listIdNameGroupByIds(collectionIds);
    const collectionNames = new Map(collectionRows.map((col) => [col.id, col.name]));
    const collectionGroupIds = new Map(collectionRows.map((col) => [col.id, col.groupId]));

    await logEvents(
      trxRepos,
      insertedRows.map((row) => ({
        userId,
        action: "added" as const,
        printingId: row.printingId,
        copyId: row.id,
        toCollectionId: row.collectionId,
        toCollectionName: collectionNames.get(row.collectionId) ?? null,
      })),
    );

    return {
      rows: rows.map((row) => ({
        ...row,
        groupId: collectionGroupIds.get(row.collectionId) ?? null,
      })),
      inserted: insertedRows.length,
      replayed: replayedRows.length,
    };
  });

  log.info(
    {
      userId,
      batchId: options?.batchId,
      requested: copies.length,
      inserted: outcome.inserted,
      replayed: outcome.replayed,
    },
    "copies added",
  );

  return outcome.rows;
}

/**
 * Applies one metadata patch to a batch of copies. Metadata edits are not
 * logged to `collection_events` (the ledger stays a movement history).
 *
 * Cross-field state is normalized via {@link normalizeCopyMetadataPatch}
 * (shared with the client's optimistic update) so a patch only has to be
 * internally consistent.
 */
export async function updateCopies(
  transact: Transact,
  userId: string,
  copyIds: string[],
  patch: CopyMetadataPatch,
): Promise<void> {
  const normalized = normalizeCopyMetadataPatch(patch);

  await transact(async (trxRepos) => {
    await loadWritableCopies(trxRepos, userId, copyIds);

    await trxRepos.copies.updateMetadataBatchById(copyIds, {
      ...normalized,
      links: normalized.links ?? undefined,
    });
  });
}

/** Must run inside the caller's transaction so the copy change and the cancellations commit together. */
export async function sweepUnfillableTrades(
  trxRepos: Repos,
  userId: string,
  printingIds: Iterable<string>,
  consent: TradeCancelConsent,
): Promise<void> {
  const distinct = [...new Set(printingIds)];
  if (distinct.length === 0) {
    return;
  }
  const pending = await trxRepos.cardTrades.listPendingPrintingIdsForGiver(userId, distinct);
  await sweepGiverPrintings(trxRepos, userId, pending, consent);
}

interface MoveTarget {
  id: string;
  name: string;
  groupId: string | null;
}

async function resolveMoveTarget(
  repos: Repos,
  userId: string,
  toCollectionId: string,
): Promise<MoveTarget> {
  const targetWritable = await repos.collections.filterWritableByViewer([toCollectionId], userId);
  if (targetWritable.length === 0) {
    throw notFound("Target collection not found");
  }
  const targetMeta = await repos.collections.listIdNameGroupByIds([toCollectionId]);
  const target = targetMeta[0];
  assertFound(target, "Target collection not found");
  return target;
}

async function moveCopiesInTransaction(
  trxRepos: Repos,
  userId: string,
  copyIds: string[],
  target: MoveTarget,
  consent: TradeCancelConsent,
): Promise<void> {
  if (!(await trxRepos.collections.lockAsMoveTarget(target.id))) {
    throw notFound("Target collection not found");
  }
  await trxRepos.copies.lockByIds(copyIds);
  const copies = await loadWritableCopies(trxRepos, userId, copyIds);

  if (target.groupId !== null) {
    const reserved = await trxRepos.cardTrades.filterReservedCopyIds(copyIds);
    if (reserved.length > 0) {
      throw conflict(
        "This card is reserved in a trade. It can only move between your own collections.",
      );
    }
  }

  await trxRepos.copies.moveBatchById(
    copies.map((row) => row.id),
    target.id,
  );

  await logEvents(
    trxRepos,
    copies.map((copy) => ({
      userId,
      action: "moved" as const,
      printingId: copy.printingId,
      copyId: copy.id,
      fromCollectionId: copy.collectionId,
      fromCollectionName: copy.collectionName,
      toCollectionId: target.id,
      toCollectionName: target.name,
    })),
  );

  if (target.groupId !== null) {
    // The copy now belongs to the group, so the owner has nothing left to
    // offer. Their trade-list entries would otherwise keep advertising it:
    // supply is built from list membership, not ownership, and nothing else
    // clears an entry whose copy left the owner's collections.
    await trxRepos.lists.deleteTradeEntriesForCopies(copyIds, userId);
  }

  // A move can take a copy out of the supply a group can see, so the owner's
  // pending trades for those printings may no longer be fillable.
  await sweepUnfillableTrades(
    trxRepos,
    userId,
    copies.map((copy) => copy.printingId),
    consent,
  );
}

/**
 * A copy reserved by a trade may still move between the owner's own personal
 * collections, but not into a group collection. Reservations pin personal
 * copies only, and the whole group would otherwise see `reserved` on a copy
 * that is not theirs.
 */
export async function moveCopies(
  repos: Repos,
  transact: Transact,
  userId: string,
  copyIds: string[],
  toCollectionId: string,
  consent: TradeCancelConsent,
): Promise<void> {
  const target = await resolveMoveTarget(repos, userId, toCollectionId);
  await transact((trxRepos) => moveCopiesInTransaction(trxRepos, userId, copyIds, target, consent));
}

function writeChunks(copyIds: readonly string[]): string[][] {
  const chunks: string[][] = [];
  for (let start = 0; start < copyIds.length; start += MAX_COPIES_PER_REQUEST) {
    chunks.push(copyIds.slice(start, start + MAX_COPIES_PER_REQUEST));
  }
  return chunks;
}

/** Each write-sized chunk sweeps on its own, as the client's chunked writes will. */
export async function previewMoveTradeCancels(
  repos: Repos,
  transact: Transact,
  userId: string,
  copyIds: string[],
  toCollectionId: string,
): Promise<TradeCancelConflictData> {
  const target = await resolveMoveTarget(repos, userId, toCollectionId);
  return previewTradeCancels(transact, async (trxRepos, consent) => {
    for (const chunk of writeChunks(copyIds)) {
      await moveCopiesInTransaction(trxRepos, userId, chunk, target, consent);
    }
  });
}

/**
 * Rejects copies pinned by a live or unresolved-sync trade reservation.
 * Trade-sync's giver path releases the reservation first, then disposes with the guard skipped via {@link disposeCopiesInTransaction}.
 */
export async function disposeCopies(
  transact: Transact,
  userId: string,
  copyIds: string[],
  consent: TradeCancelConsent,
): Promise<void> {
  await transact((trxRepos) => disposeCopiesInTransaction(trxRepos, userId, copyIds, consent));
}

export function previewDisposeTradeCancels(
  transact: Transact,
  userId: string,
  copyIds: string[],
): Promise<TradeCancelConflictData> {
  return previewTradeCancels(transact, async (trxRepos, consent) => {
    for (const chunk of writeChunks(copyIds)) {
      await disposeCopiesInTransaction(trxRepos, userId, chunk, consent);
    }
  });
}

/**
 * The body of {@link disposeCopies}, runnable inside an existing transaction.
 * Lets trade-sync combine reservation-release + dispose atomically while
 * keeping a single copy-deletion choke point that emits `removed` events.
 */
export async function disposeCopiesInTransaction(
  trxRepos: Repos,
  userId: string,
  copyIds: string[],
  consent: TradeCancelConsent,
  options?: { skipReservationGuard?: boolean },
): Promise<void> {
  const printingIds = await disposeCopiesUnswept(trxRepos, userId, copyIds, options);
  // Close now: a pending trade counting on a deleted copy would otherwise
  // 409 only when accepted, possibly a week later.
  await sweepUnfillableTrades(trxRepos, userId, printingIds, consent);
}

/** Returns the disposed copies' printing ids; the caller owes the trade sweep. */
export async function disposeCopiesUnswept(
  trxRepos: Repos,
  userId: string,
  copyIds: string[],
  options?: { skipReservationGuard?: boolean },
): Promise<string[]> {
  // Lock the copy rows first so a concurrent trade-accept or loan reserving one
  // of them serializes against this dispose. Without the lock the reservation
  // guard below could pass, the reserve pin lands in the gap, and the delete
  // would cascade the just-created reservation away.
  await trxRepos.copies.lockByIds(copyIds);

  const copies = await loadWritableCopies(trxRepos, userId, copyIds);

  // A reserved copy is physically promised to a trade — refuse to destroy it.
  // Same for a copy out on a loan: write-off releases its pins first and then
  // disposes in the same transaction, so the guard passes there.
  if (options?.skipReservationGuard !== true) {
    const pins = await trxRepos.cardTrades.listReservationsForCopies(copyIds);
    if (pins.length > 0) {
      // A pin on a still-live trade is freed by cancelling it. A pin that
      // outlived completion (the giver never resolved their sync) is not:
      // cancel only accepts pending/reserved, so pointing at it would name an
      // impossible remedy. Resolving or skipping the sync releases those.
      const live = pins.some((pin) => pin.status === "pending" || pin.status === "reserved");
      throw conflict(
        live
          ? "This card is reserved in an active trade — cancel the trade to free it."
          : "This card is still reserved by a completed trade. Resolve or skip that trade's sync to free it.",
      );
    }
    const loaned = await trxRepos.loans.filterLoanedCopyIds(copyIds);
    if (loaned.length > 0) {
      throw conflict("This card is lent out — mark the loan returned or written off to free it.");
    }
  }

  // Log before deleting, while the copy FK is still valid.
  await logEvents(
    trxRepos,
    copies.map((copy) => ({
      userId,
      action: "removed" as const,
      printingId: copy.printingId,
      copyId: copy.id,
      fromCollectionId: copy.collectionId,
      fromCollectionName: copy.collectionName,
    })),
  );

  // Hard-delete copies (collection_events.copy_id → SET NULL via FK)
  await trxRepos.copies.deleteBatchById(copies.map((row) => row.id));

  return copies.map((row) => row.printingId);
}
