import type { MoveListEntriesResolution } from "@openrift/shared/contracts/lists";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import type { ListKind, ListMoveResponse } from "@openrift/shared/types/api/list";

import type { Repos, Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import type { MoveEntry, NewEntryValues } from "../repositories/lists-entries.js";

const KIND_RANK: Record<ListKind, number> = { card: 0, printing: 1, copy: 2 };

function badRequest(message: string): AppError {
  return new AppError(400, ERROR_CODES.BAD_REQUEST, message);
}

/** Merge semantics mirror `bulkCreateEntries`: card/printing entries absorb into an
 * existing target keeping its tradeOverride; copy entries discard the source row. */
export async function moveListEntries(
  repos: Repos,
  transact: Transact,
  userId: string,
  fromListId: string,
  toListId: string,
  entryIds: string[],
  resolutions: MoveListEntriesResolution[] = [],
  mode: "move" | "copy" = "move",
): Promise<ListMoveResponse> {
  if (fromListId === toListId) {
    throw badRequest("Source and destination must differ");
  }

  const [source, destination] = await Promise.all([
    repos.lists.getByIdForUser(fromListId, userId),
    repos.lists.getByIdForUser(toListId, userId),
  ]);
  if (!source) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "Source list not found");
  }
  if (!destination) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "Destination list not found");
  }

  return transact(async (trxRepos) => {
    const entries = await trxRepos.lists.entriesForMove(fromListId, userId, entryIds);
    if (entries.length === 0) {
      return { moved: 0, merged: 0 };
    }

    const personalOnly = destination.intent !== "organize";
    if (source.kind === "copy" && personalOnly) {
      const owned = await trxRepos.lists.ownedCopyTargets(
        userId,
        entries.map((entry) => entry.copyId).filter((id) => id !== null),
        true,
      );
      if (owned.length !== entries.length) {
        throw badRequest("Group-shared copies can't be moved to a wish or trade list");
      }
    }
    const shared = { listId: toListId, userId, kind: destination.kind };
    const carry = (entry: MoveEntry) => ({
      pricePref: entry.pricePref,
      priceAbsoluteCents: entry.priceAbsoluteCents,
      tradeType: entry.tradeType,
    });
    const resolutionById = new Map(resolutions.map((r) => [r.entryId, r]));
    const widening = KIND_RANK[destination.kind] > KIND_RANK[source.kind];
    let insertable: NewEntryValues[];

    if (destination.kind === "copy" && source.kind === "copy") {
      insertable = entries.map((entry) => ({
        ...shared,
        ...carry(entry),
        cardId: null,
        printingId: null,
        copyId: entry.copyId,
        quantity: 1,
      }));
    } else if (destination.kind === "copy") {
      const picks = entries.map((entry) => {
        const copyIds = resolutionById.get(entry.id)?.copyIds;
        if (!copyIds) {
          throw badRequest("Pick the copies to move onto a copy list");
        }
        return { entry, copyIds };
      });
      const owned = await trxRepos.lists.ownedCopyTargets(
        userId,
        picks.flatMap((pick) => pick.copyIds),
        personalOnly,
      );
      const ownedById = new Map(owned.map((row) => [row.copyId, row]));
      insertable = picks.flatMap(({ entry, copyIds }) =>
        copyIds.map((copyId) => {
          const row = ownedById.get(copyId);
          const matches =
            row &&
            (source.kind === "printing"
              ? row.printingId === entry.printingId
              : row.cardId === entry.cardId);
          if (!matches) {
            throw badRequest("Picked copies must be yours and match the entry");
          }
          return {
            ...shared,
            ...carry(entry),
            cardId: null,
            printingId: null,
            copyId,
            quantity: 1,
          };
        }),
      );
    } else if (destination.kind === "printing" && widening) {
      const picks = entries.map((entry) => {
        const printingId = resolutionById.get(entry.id)?.printingId;
        if (!printingId) {
          throw badRequest("Pick the printing to move onto a printing list");
        }
        return { entry, printingId };
      });
      const printings = await trxRepos.lists.printingCardIds(picks.map((pick) => pick.printingId));
      const cardByPrintingId = new Map(printings.map((row) => [row.id, row.cardId]));
      insertable = picks.map(({ entry, printingId }) => {
        if (cardByPrintingId.get(printingId) !== entry.cardId) {
          throw badRequest("Picked printing must belong to the entry's card");
        }
        return {
          ...shared,
          ...carry(entry),
          cardId: null,
          printingId,
          copyId: null,
          quantity: entry.quantity,
        };
      });
    } else {
      insertable = entries.map((entry) => {
        const target =
          destination.kind === "printing"
            ? { cardId: null, printingId: entry.resolvedPrintingId, copyId: null }
            : { cardId: entry.resolvedCardId, printingId: null, copyId: null };
        if (target.cardId === null && target.printingId === null) {
          throw badRequest("Entry target could not be resolved");
        }
        return { ...shared, ...carry(entry), ...target, quantity: entry.quantity };
      });
    }

    const upsertResult = await trxRepos.lists.bulkCreateEntries(destination.kind, insertable);
    if (mode === "copy") {
      return { moved: entries.length, merged: upsertResult.updated };
    }

    const sourceIds = entries.map((entry) => entry.id);
    const deleted = await trxRepos.lists.deleteEntriesByIds(sourceIds, fromListId, userId);
    const moved = Number(deleted.numDeletedRows);

    return { moved, merged: upsertResult.updated };
  });
}
