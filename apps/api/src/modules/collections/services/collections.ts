import type { TradeCancelConflictData } from "@openrift/shared/contracts/fields";
import type { ResetCollectionsResponse } from "@openrift/shared/types/api/collection";

import type { Repos, Transact } from "../../../deps.js";
import { conflict } from "../../../errors.js";
import { keyBatches } from "../../../lib/bind-batches.js";
import type { TradeCancelConsent } from "../../groups/services/trade-supply.js";
import { previewTradeCancels } from "../../groups/services/trade-supply.js";
import { logEvents } from "../../system/services/event-logger.js";
import { disposeCopiesUnswept, sweepUnfillableTrades } from "./copies.js";

export interface DeleteCollectionOpts {
  collectionId: string;
  collectionName: string;
  moveCopiesTo: string;
  targetName: string;
  userId: string;
}

async function deleteCollectionInTransaction(
  trxRepos: Repos,
  opts: DeleteCollectionOpts,
  consent: TradeCancelConsent,
): Promise<void> {
  const { collectionId, collectionName, moveCopiesTo, targetName, userId } = opts;

  await trxRepos.collections.lockById(collectionId);
  const copies = await trxRepos.collections.listCopiesInCollection(collectionId);

  if (copies.length > 0) {
    await trxRepos.collections.moveCopiesBetweenCollections(collectionId, moveCopiesTo);

    await logEvents(
      trxRepos,
      copies.map((copy) => ({
        userId,
        action: "moved" as const,
        printingId: copy.printingId,
        copyId: copy.id,
        fromCollectionId: collectionId,
        fromCollectionName: collectionName,
        toCollectionId: moveCopiesTo,
        toCollectionName: targetName,
      })),
    );
  }

  // Events snapshot id and name, not an FK: deleting the collection must not erase history that references it.
  await trxRepos.collections.deleteByIdForUser(collectionId, userId);

  // A trade-list rule can pick copies by collection, so the move to the inbox can shrink supply.
  await sweepUnfillableTrades(
    trxRepos,
    userId,
    copies.map((copy) => copy.printingId),
    consent,
  );
}

/**
 * Deletes a collection, atomically relocating its copies to the target
 * collection and logging move events.
 */
export async function deleteCollection(
  transact: Transact,
  opts: DeleteCollectionOpts,
  consent: TradeCancelConsent,
): Promise<void> {
  await transact((trxRepos) => deleteCollectionInTransaction(trxRepos, opts, consent));
}

export function previewDeleteCollectionTradeCancels(
  transact: Transact,
  opts: DeleteCollectionOpts,
): Promise<TradeCancelConflictData> {
  return previewTradeCancels(transact, (trxRepos, consent) =>
    deleteCollectionInTransaction(trxRepos, opts, consent),
  );
}

interface ClearCollectionOpts {
  collectionId: string;
  userId: string;
}

interface ClearCollectionResult {
  removedCount: number;
  keptCopyIds: string[];
}

async function clearCollectionInTransaction(
  trxRepos: Repos,
  opts: ClearCollectionOpts,
  consent: TradeCancelConsent,
): Promise<ClearCollectionResult> {
  const { collectionId, userId } = opts;
  const copies = await trxRepos.collections.listCopiesInCollection(collectionId);
  const keptCopyIds: string[] = [];
  const disposedPrintingIds: string[] = [];
  let removedCount = 0;

  for (const copyIds of keyBatches(copies.map((copy) => copy.id))) {
    // Lock before reading the pins, or a concurrent trade-accept/loan could
    // pin a copy in the gap and have the delete cascade the pin away.
    await trxRepos.copies.lockByIds(copyIds);
    const reserved = await trxRepos.cardTrades.filterReservedCopyIds(copyIds);
    const loaned = await trxRepos.loans.filterLoanedCopyIds(copyIds);
    const kept = new Set([...reserved, ...loaned]);
    const disposable = copyIds.filter((id) => !kept.has(id));

    if (disposable.length > 0) {
      // The trade/loan pins were already filtered out above, inside this same
      // transaction, so the dispose-level guard would only re-check them.
      disposedPrintingIds.push(
        ...(await disposeCopiesUnswept(trxRepos, userId, disposable, {
          skipReservationGuard: true,
        })),
      );
    }

    keptCopyIds.push(...kept);
    removedCount += disposable.length;
  }

  await sweepUnfillableTrades(trxRepos, userId, disposedPrintingIds, consent);

  return { removedCount, keptCopyIds };
}

/**
 * Copies reserved by a live trade or out on a loan are kept, not cleared,
 * and reported back.
 */
export function clearCollection(
  transact: Transact,
  opts: ClearCollectionOpts,
  consent: TradeCancelConsent,
): Promise<ClearCollectionResult> {
  return transact((trxRepos) => clearCollectionInTransaction(trxRepos, opts, consent));
}

export function previewClearCollectionTradeCancels(
  transact: Transact,
  opts: ClearCollectionOpts,
): Promise<TradeCancelConflictData> {
  return previewTradeCancels(transact, (trxRepos, consent) =>
    clearCollectionInTransaction(trxRepos, opts, consent),
  );
}

// Keeps guard IN-lists and event batch inserts well under postgres.js's
// ~65k bind-parameter limit even for very large collections.
const RESET_BATCH_SIZE = 1000;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

async function resetCollectionsInTransaction(
  trxRepos: Repos,
  userId: string,
  consent: TradeCancelConsent,
): Promise<ResetCollectionsResponse> {
  const copies = await trxRepos.copies.listInPersonalCollections(userId);
  const copyIdBatches = chunk(
    copies.map((copy) => copy.id),
    RESET_BATCH_SIZE,
  );

  // Each batch is locked before its pin reads, so a concurrent
  // trade-accept/loan can't pin a copy between the guard and the delete.
  for (const batch of copyIdBatches) {
    await trxRepos.copies.lockByIds(batch);
    const reserved = await trxRepos.cardTrades.filterReservedCopyIds(batch);
    if (reserved.length > 0) {
      throw conflict(
        "Some of your cards are reserved in active trades — cancel those trades first.",
      );
    }
    const loaned = await trxRepos.loans.filterLoanedCopyIds(batch);
    if (loaned.length > 0) {
      throw conflict(
        "Some of your cards are lent out — mark those loans returned or written off first.",
      );
    }
  }

  // Snapshot before the wipe: only lists that had entries going in are
  // prune candidates, so a list the user emptied earlier stays around.
  const pruneCandidateIds = await trxRepos.lists.listIdsWithEntries(userId);

  // Log disposal events while the copy FKs still resolve (same shape as
  // disposeCopies; collection_events.copy_id goes SET NULL on delete).
  for (const batch of chunk(copies, RESET_BATCH_SIZE)) {
    await logEvents(
      trxRepos,
      batch.map((copy) => ({
        userId,
        action: "removed" as const,
        printingId: copy.printingId,
        copyId: copy.id,
        fromCollectionId: copy.collectionId,
        fromCollectionName: copy.collectionName,
      })),
    );
  }

  // Copies first — a DB trigger blocks deleting a non-empty collection.
  const removedCopies = await trxRepos.copies.deleteAllInPersonalCollections(userId);
  const removedCollections = await trxRepos.collections.deleteAllPersonalExceptInbox(userId);
  await trxRepos.collections.ensureInbox(userId);
  const removedLists = await trxRepos.lists.deleteEmptyWithoutRules(userId, pruneCandidateIds);

  await sweepUnfillableTrades(
    trxRepos,
    userId,
    copies.map((copy) => copy.printingId),
    consent,
  );

  return { removedCopies, removedCollections, removedLists };
}

/**
 * Group collections and their copies are untouched. Refuses (409) while any
 * of the user's copies are reserved in an active trade or out on a loan.
 */
export function resetCollections(
  transact: Transact,
  userId: string,
  consent: TradeCancelConsent,
): Promise<ResetCollectionsResponse> {
  return transact((trxRepos) => resetCollectionsInTransaction(trxRepos, userId, consent));
}

export function previewResetCollectionsTradeCancels(
  transact: Transact,
  userId: string,
): Promise<TradeCancelConflictData> {
  return previewTradeCancels(transact, (trxRepos, consent) =>
    resetCollectionsInTransaction(trxRepos, userId, consent),
  );
}
