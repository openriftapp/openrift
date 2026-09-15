import type { BoardDocument } from "@openrift/shared/board-state";
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

export interface SharedBoardState {
  boardState: BoardState;
  ownerName: string | null;
}

export interface BoardStateValues {
  title: string;
  answer: string | null;
  coreRulesVersion: string | null;
  tournamentRulesVersion: string | null;
  document: BoardDocument;
}

/** Owner-scoped methods filter on `userId`; the share-token and featured reads are the unscoped ones. */
export function boardStatesRepo(db: Kysely<Database>) {
  return {
    listForUser(userId: string): Promise<BoardState[]> {
      return db
        .selectFrom("boardStates")
        .selectAll()
        .where("userId", "=", userId)
        .orderBy("updatedAt", "desc")
        .execute();
    },

    getByIdForUser(id: string, userId: string): Promise<BoardState | undefined> {
      return db
        .selectFrom("boardStates")
        .selectAll()
        .where("id", "=", id)
        .where("userId", "=", userId)
        .executeTakeFirst();
    },

    create(userId: string, values: BoardStateValues): Promise<BoardState> {
      return db
        .insertInto("boardStates")
        .values({ userId, ...values })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    /** `undefined` fields are left alone; the caller passes at least one field. */
    update(
      id: string,
      userId: string,
      values: Partial<BoardStateValues>,
    ): Promise<BoardState | undefined> {
      return db
        .updateTable("boardStates")
        .set(values)
        .where("id", "=", id)
        .where("userId", "=", userId)
        .returningAll()
        .executeTakeFirst();
    },

    async remove(id: string, userId: string): Promise<boolean> {
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

    async findByShareToken(shareToken: string): Promise<SharedBoardState | undefined> {
      const found = await findByShareToken(db, "boardStates", shareToken);
      return found ? { boardState: found.row, ownerName: found.ownerName } : undefined;
    },

    getById(id: string): Promise<BoardState | undefined> {
      return db.selectFrom("boardStates").selectAll().where("id", "=", id).executeTakeFirst();
    },

    listAllWithOwner(): Promise<BoardStateWithOwner[]> {
      return db
        .selectFrom("boardStates as b")
        .innerJoin("users as u", "u.id", "b.userId")
        .selectAll("b")
        .select("u.name as ownerName")
        .orderBy("b.updatedAt", "desc")
        .execute();
    },

    async setFeatured(id: string, featured: boolean): Promise<BoardStateWithOwner | undefined> {
      const row = await db
        .updateTable("boardStates")
        .set({ isFeatured: featured })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
      if (!row) {
        return undefined;
      }
      const owner = await db
        .selectFrom("users")
        .select("name")
        .where("id", "=", row.userId)
        .executeTakeFirst();
      return { ...row, ownerName: owner?.name ?? null };
    },

    listFeatured(): Promise<BoardState[]> {
      return db
        .selectFrom("boardStates")
        .selectAll()
        .where("isFeatured", "=", true)
        .where("isPublic", "=", true)
        .where("shareToken", "is not", null)
        .orderBy("updatedAt", "desc")
        .execute();
    },
  };
}
