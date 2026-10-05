import { copiesContract } from "@openrift/shared/contracts/copies";
import type {
  CopyAddResponse,
  CopyListMembershipsResponse,
  CopyListResponse,
} from "@openrift/shared/types/api/collection";
import { implement } from "@orpc/server";

import { keysetPage } from "../../../lib/keyset-cursor.js";
import { isCheckViolation, isForeignKeyViolation } from "../../../lib/pg-errors.js";
import { pinWatermark, takePage } from "../../../lib/xid-watermark.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { clampCopiesLimit } from "../lib/copies-page-limit.js";
import type { CopyDeltaCursor } from "../lib/copy-delta-cursor.js";
import { buildCopyDeltaCursor, parseCopyDeltaCursor } from "../lib/copy-delta-cursor.js";
import { toCopy } from "../lib/copy-presenters.js";
import { addCopies, disposeCopies, moveCopies, updateCopies } from "../services/copies.js";

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
  const { page: rowPage, drained: rowsDrained } = takePage(rows, limit);
  const { page: deletionPage, drained: deletionsDrained } = takePage(deletions, limit);
  const drained = rowsDrained && deletionsDrained;
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
    // A cursor watermark above the server's would filter every later delta out and freeze that caller's store.
    const pinnedXid = pinWatermark(currentSafeXid, cursor?.safeXid);

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
    const repos = context.repos;
    const transact = context.transact;
    const userId = context.userId;
    let created;
    try {
      created = await addCopies(repos, transact, userId, input.copies, {
        batchId: input.batchId,
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw errors.BAD_REQUEST({ message: "One or more printings do not exist" });
      }
      throw error;
    }
    return { items: created };
  }),

  move: os.move.handler(async ({ input, context }): Promise<void> => {
    await moveCopies(
      context.repos,
      context.transact,
      context.userId,
      input.copyIds,
      input.toCollectionId,
    );
  }),

  update: os.update.handler(async ({ input, context, errors }): Promise<void> => {
    try {
      await updateCopies(context.transact, context.userId, input.copyIds, input.patch);
    } catch (error) {
      // FK = unknown condition/grader slug; check = bad grader/grade pairing.
      if (isForeignKeyViolation(error) || isCheckViolation(error)) {
        throw errors.BAD_REQUEST({ message: "Unknown condition or grader" });
      }
      throw error;
    }
  }),

  dispose: os.dispose.handler(async ({ input, context }): Promise<void> => {
    await disposeCopies(context.transact, context.userId, input.copyIds);
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
