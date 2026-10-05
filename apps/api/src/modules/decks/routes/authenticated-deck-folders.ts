import { deckFoldersContract } from "@openrift/shared/contracts/deck-folders";
import type { DeckFolderListResponse, DeckFolderResponse } from "@openrift/shared/types/api/deck";
import { implement } from "@orpc/server";

import { assertExisted, assertFound } from "../../../lib/assertions.js";
import { isUniqueViolationOn } from "../../../lib/pg-errors.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { toDeckFolder } from "../lib/deck-folder-presenters.js";

const NAME_TAKEN = "You already have a folder with that name";

/** Turns the case-insensitive name collision into a 409; other errors rethrow. */
function rethrowFolderError(error: unknown, conflict: (message: string) => Error): never {
  if (isUniqueViolationOn(error, "uq_deck_folders_user_name")) {
    throw conflict(NAME_TAKEN);
  }
  throw error;
}

const os = implement(deckFoldersContract).$context<ApiContext>().use(requireAuthedUser);

export const deckFoldersRouter = {
  list: os.list.handler(async ({ context }): Promise<DeckFolderListResponse> => {
    const rows = await context.repos.deckFolders.listForUser(context.userId);
    return { items: rows.map((row) => toDeckFolder(row)) };
  }),

  create: os.create.handler(async ({ input, context, errors }): Promise<DeckFolderResponse> => {
    const { name } = input;
    // Not a check-then-act: the unique index is the arbiter, so two concurrent
    // creates of the same name give one folder and one 409.
    let row;
    try {
      row =
        input.id === undefined
          ? await context.repos.deckFolders.create(context.userId, name)
          : await context.repos.deckFolders.createUnlessIdTaken(context.userId, name, input.id);
    } catch (error) {
      rethrowFolderError(error, (message) => errors.CONFLICT({ message }));
    }
    if (row) {
      return toDeckFolder(row);
    }
    const folders = await context.repos.deckFolders.listForUser(context.userId);
    const existing = folders.find((folder) => folder.id === input.id);
    if (!existing) {
      throw errors.CONFLICT({ message: "Folder id already belongs to someone else" });
    }
    return toDeckFolder(existing);
  }),

  update: os.update.handler(async ({ input, context, errors }): Promise<DeckFolderResponse> => {
    let row;
    try {
      row = await context.repos.deckFolders.rename(input.id, context.userId, input.name);
    } catch (error) {
      rethrowFolderError(error, (message) => errors.CONFLICT({ message }));
    }
    assertFound(row, "Folder not found");
    return toDeckFolder(row);
  }),

  remove: os.remove.handler(async ({ input, context }): Promise<void> => {
    // Membership rows cascade; the decks themselves are untouched.
    const deleted = await context.repos.deckFolders.deleteByIdForUser(input.id, context.userId);
    assertExisted(deleted, "Folder not found");
  }),

  reorder: os.reorder.handler(async ({ input, context }): Promise<void> => {
    await context.repos.deckFolders.reorder(context.userId, input.orderedIds);
  }),

  setForDeck: os.setForDeck.handler(async ({ input, context }): Promise<DeckFolderListResponse> => {
    const { decks, deckFolders } = context.repos;
    const userId = context.userId;
    const deck = await decks.getByIdForUser(input.id, userId);
    assertFound(deck, "Deck not found");
    await deckFolders.setForDeck(input.id, userId, input.folderIds);
    // Returning the full folder list keeps the client's deck counts correct
    // without a second round trip — every count can shift on one membership edit.
    const rows = await deckFolders.listForUser(userId);
    return { items: rows.map((row) => toDeckFolder(row)) };
  }),
};
