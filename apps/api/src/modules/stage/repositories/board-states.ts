import type { BoardDocument } from "@openrift/shared/board-state";
import { upgradeBoardDocument } from "@openrift/shared/board-state";
import { createLogger } from "@openrift/shared/logger";
import type { Kysely, Selectable } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { BoardStatesTable } from "../../../db/tables/board-states.js";
import {
  findByShareToken,
  selectShareState,
  updateShareState,
} from "../../../repositories/query-helpers.js";

export type BoardState = Selectable<BoardStatesTable>;

export type BoardStateWithOwner = BoardState & { ownerName: string | null };

/** The email only feeds the owner's gravatar hash; it never reaches a response. */
export interface SharedBoardState {
  boardState: BoardState;
  ownerName: string | null;
  ownerEmail: string;
}

export type BoardStatePins = Pick<BoardState, "id" | "coreRulesVersion" | "tournamentRulesVersion">;

export interface BoardStateValues {
  title: string;
  coreRulesVersion: string | null;
  tournamentRulesVersion: string | null;
  document: BoardDocument;
}

const log = createLogger("board-states");

/** Null for a stored document that no longer parses; the row itself is left untouched. */
function readable<T extends { id: string; document: BoardDocument }>(row: T): T | null {
  const document = upgradeBoardDocument(row.document);
  if (document === null) {
    log.error({ boardStateId: row.id }, "stored board document does not parse");
    return null;
  }
  return { ...row, document };
}

function readableRows<T extends { id: string; document: BoardDocument }>(rows: T[]): T[] {
  return rows.flatMap((row) => readable(row) ?? []);
}

function readableOrUndefined<T extends { id: string; document: BoardDocument }>(
  row: T | undefined,
): T | undefined {
  return row === undefined ? undefined : (readable(row) ?? undefined);
}

function upgraded<T extends { id: string; document: BoardDocument }>(row: T): T {
  const upgradedRow = readable(row);
  if (upgradedRow === null) {
    throw new Error(`Board state ${row.id} holds a document that no longer parses`);
  }
  return upgradedRow;
}

/** Owner-scoped methods filter on `userId`; the share-token and featured reads are the unscoped ones. */
export function boardStatesRepo(db: Kysely<Database>) {
  return {
    async listForUser(userId: string): Promise<BoardState[]> {
      const rows = await db
        .selectFrom("boardStates")
        .selectAll()
        .where("userId", "=", userId)
        .orderBy("updatedAt", "desc")
        .execute();
      return readableRows(rows);
    },

    async getByIdForUser(id: string, userId: string): Promise<BoardState | undefined> {
      const row = await db
        .selectFrom("boardStates")
        .selectAll()
        .where("id", "=", id)
        .where("userId", "=", userId)
        .executeTakeFirst();
      return readableOrUndefined(row);
    },

    /** Reads no document, so the owner can overwrite one that no longer parses. */
    getPinsForUser(id: string, userId: string): Promise<BoardStatePins | undefined> {
      return db
        .selectFrom("boardStates")
        .select(["id", "coreRulesVersion", "tournamentRulesVersion"])
        .where("id", "=", id)
        .where("userId", "=", userId)
        .executeTakeFirst();
    },

    async create(userId: string, values: BoardStateValues): Promise<BoardState> {
      const row = await db
        .insertInto("boardStates")
        .values({ userId, ...values })
        .returningAll()
        .executeTakeFirstOrThrow();
      return upgraded(row);
    },

    /** `undefined` fields are left alone; the caller passes at least one field. */
    async update(
      id: string,
      userId: string,
      values: Partial<BoardStateValues>,
    ): Promise<BoardState | undefined> {
      const row = await db
        .updateTable("boardStates")
        .set(values)
        .where("id", "=", id)
        .where("userId", "=", userId)
        .returningAll()
        .executeTakeFirst();
      return readableOrUndefined(row);
    },

    async deleteByIdForUser(id: string, userId: string): Promise<boolean> {
      const result = await db
        .deleteFrom("boardStates")
        .where("id", "=", id)
        .where("userId", "=", userId)
        .executeTakeFirst();
      return (result.numDeletedRows ?? 0n) > 0n;
    },

    getShareState(
      id: string,
      userId: string,
    ): Promise<Pick<BoardState, "shareToken" | "isPublic"> | undefined> {
      return selectShareState(db, "boardStates", id, userId);
    },

    setShare(
      id: string,
      userId: string,
      shareToken: string | null,
      isPublic: boolean,
    ): Promise<Pick<BoardState, "shareToken" | "isPublic"> | undefined> {
      return updateShareState(db, "boardStates", id, userId, shareToken, isPublic);
    },

    async getByShareToken(shareToken: string): Promise<SharedBoardState | undefined> {
      const found = await findByShareToken(db, "boardStates", shareToken);
      const boardState = readableOrUndefined(found?.row);
      return found && boardState
        ? { boardState, ownerName: found.ownerName, ownerEmail: found.ownerEmail }
        : undefined;
    },

    async getById(id: string): Promise<BoardState | undefined> {
      const row = await db
        .selectFrom("boardStates")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return readableOrUndefined(row);
    },

    async listAllWithOwner(): Promise<BoardStateWithOwner[]> {
      const rows = await db
        .selectFrom("boardStates as b")
        .innerJoin("users as u", "u.id", "b.userId")
        .selectAll("b")
        .select("u.name as ownerName")
        .orderBy("b.updatedAt", "desc")
        .execute();
      return readableRows(rows);
    },

    async setFeatured(id: string, featured: boolean): Promise<BoardStateWithOwner | undefined> {
      const row = await db
        .updateTable("boardStates")
        .set({ isFeatured: featured })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
      const readableRow = readableOrUndefined(row);
      if (!readableRow) {
        return undefined;
      }
      const owner = await db
        .selectFrom("users")
        .select("name")
        .where("id", "=", readableRow.userId)
        .executeTakeFirst();
      return { ...readableRow, ownerName: owner?.name ?? null };
    },

    async listFeatured(): Promise<BoardState[]> {
      const rows = await db
        .selectFrom("boardStates")
        .selectAll()
        .where("isFeatured", "=", true)
        .where("isPublic", "=", true)
        .where("shareToken", "is not", null)
        .orderBy("updatedAt", "desc")
        .execute();
      return readableRows(rows);
    },
  };
}
