import { copiesContract } from "@openrift/shared/contracts/copies";
import type {
  CopyAddResponse,
  CopyListMembershipsResponse,
  CopyListResponse,
} from "@openrift/shared/types/api/collection";
import { implement } from "@orpc/server";

import { keysetPage } from "../../../lib/keyset-cursor.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { clampCopiesLimit } from "../lib/copies-page-limit.js";
import type { CopyDeltaCursor } from "../lib/copy-delta-cursor.js";
import { buildCopyDeltaCursor, parseCopyDeltaCursor } from "../lib/copy-delta-cursor.js";
import { toCopy } from "../lib/copy-presenters.js";

const os = implement(copiesContract).$context<ApiContext>().use(requireAuthedUser);

type CopiesRepo = ApiContext["repos"]["copies"];

/** The watermark ships only on the last page, so a partial read cannot advance it past the remainder. */
async function deltaPage(
  copies: CopiesRepo,
  userId: string,
  since: string,
  safeXid: string,
  limit: number,
  cursor?: CopyDeltaCursor,
): Promise<CopyListResponse> {
  const [rows, deletions] = await Promise.all([
    copies.listChangedForAccessibleCollections(userId, since, safeXid, limit, cursor?.row),
    copies.deletionsSince(userId, since, safeXid, limit, cursor?.deletion),
  ]);
  const rowPage = rows.slice(0, limit);
  const deletionPage = deletions.slice(0, limit);
  const drained = rows.length <= limit && deletions.length <= limit;
  const lastRow = rowPage.at(-1);
  const lastDeletion = deletionPage.at(-1);
  return {
    items: rowPage.map((row) => toCopy(row)),
    nextCursor: null,
    deletedIds: deletionPage.map((row) => row.copyId),
    nextDeltaCursor: drained
      ? null
      : buildCopyDeltaCursor({
          safeXid,
          row: lastRow === undefined ? undefined : { xid: lastRow.updatedXid, id: lastRow.id },
          deletion:
            lastDeletion === undefined
              ? undefined
              : { xid: lastDeletion.deletedXid, id: lastDeletion.copyId },
        }),
    ...(drained ? { syncedXid: safeXid } : {}),
  };
}

export const copiesRouter = {
  list: os.list.handler(async ({ input, context }): Promise<CopyListResponse> => {
    const { copies } = context.repos;
    const effectiveLimit = clampCopiesLimit(input.limit);
    const cursor =
      input.deltaCursor === undefined ? undefined : parseCopyDeltaCursor(input.deltaCursor);
    const currentSafeXid = await copies.currentSafeXid();
    // The cursor's watermark is client input, so it may only narrow the window.
    // A larger one would filter every later delta out and freeze that caller's store.
    const pinnedXid =
      cursor !== undefined && BigInt(cursor.safeXid) < BigInt(currentSafeXid)
        ? cursor.safeXid
        : currentSafeXid;

    // A watermark above the server's own would match no row and still report the
    // read drained, skipping everything written between the two.
    if (input.since !== undefined && BigInt(input.since) <= BigInt(currentSafeXid)) {
      const prunedBefore = await copies.prunedThroughXid();
      if (BigInt(input.since) > BigInt(prunedBefore)) {
        const page = await deltaPage(
          copies,
          context.userId,
          input.since,
          pinnedXid,
          effectiveLimit,
          cursor,
        );
        // The sweep commits in its own transaction and can land between the check
        // and the read, dropping tombstones this window still needs.
        const prunedAfter = await copies.prunedThroughXid();
        if (BigInt(input.since) > BigInt(prunedAfter)) {
          return page;
        }
      }
    }

    const rows = await copies.listForAccessibleCollections(
      context.userId,
      effectiveLimit,
      input.cursor,
    );
    return { ...keysetPage(rows, effectiveLimit, toCopy), syncedXid: currentSafeXid };
  }),

  add: os.add.handler(async ({ input, context, errors }): Promise<CopyAddResponse> => {
    const { addCopies: addCopiesService } = context.services;
    const repos = context.repos;
    const transact = context.transact;
    const userId = context.userId;
    let created;
    try {
      created = await addCopiesService(repos, transact, userId, input.copies, {
        batchId: input.batchId,
      });
    } catch (error) {
      // 23503 = foreign_key_violation: printingId does not exist.
      if (error instanceof Error && "code" in error && error.code === "23503") {
        throw errors.BAD_REQUEST({ message: "One or more printings do not exist" });
      }
      throw error;
    }
    return { items: created };
  }),

  move: os.move.handler(async ({ input, context }): Promise<void> => {
    const { moveCopies: moveCopiesService } = context.services;
    await moveCopiesService(
      context.repos,
      context.transact,
      context.userId,
      input.copyIds,
      input.toCollectionId,
    );
  }),

  update: os.update.handler(async ({ input, context, errors }): Promise<void> => {
    const { updateCopies: updateCopiesService } = context.services;
    try {
      await updateCopiesService(context.transact, context.userId, input.copyIds, input.patch);
    } catch (error) {
      // 23503 = unknown condition/grader slug; 23514 = bad grader/grade pairing.
      if (
        error instanceof Error &&
        "code" in error &&
        (error.code === "23503" || error.code === "23514")
      ) {
        throw errors.BAD_REQUEST({ message: "Unknown condition or grader" });
      }
      throw error;
    }
  }),

  dispose: os.dispose.handler(async ({ input, context }): Promise<void> => {
    const { disposeCopies: disposeCopiesService } = context.services;
    await disposeCopiesService(context.transact, context.userId, input.copyIds);
  }),

  listMemberships: os.listMemberships.handler(
    async ({ input, context }): Promise<CopyListMembershipsResponse> => {
      const { lists } = context.repos;
      return await lists.listMembershipsForCopies(
        input.copyIds,
        context.userId,
        input.excludeListId,
      );
    },
  ),
};
