import type { ContactMethod, ContactMethodType } from "@openrift/shared/types/api/contact-method";
import type { Kysely, SqlBool } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { reorderBySortOrder } from "../../../repositories/query-helpers.js";

/** All writes are scoped by `userId` so a caller can only touch their own rows. */
export function userContactMethodsRepo(db: Kysely<Database>) {
  return {
    listForUser(userId: string): Promise<ContactMethod[]> {
      return db
        .selectFrom("userContactMethods")
        .select(["id", "type", "value"])
        .where("userId", "=", userId)
        .orderBy("sortOrder", "asc")
        .orderBy("id", "asc")
        .execute();
    },

    /** Appends a method after the user's existing ones. */
    async create(userId: string, type: ContactMethodType, value: string): Promise<ContactMethod> {
      const next = await db
        .selectFrom("userContactMethods")
        .select((eb) => eb.fn.coalesce(eb.fn.max("sortOrder"), eb.lit(-1)).as("maxOrder"))
        .where("userId", "=", userId)
        .executeTakeFirstOrThrow();

      return db
        .insertInto("userContactMethods")
        .values({ userId, type, value, sortOrder: Number(next.maxOrder) + 1 })
        .returning(["id", "type", "value"])
        .executeTakeFirstOrThrow();
    },

    /** Returns `undefined` if the user owns no such method. */
    update(
      id: string,
      userId: string,
      type: ContactMethodType,
      value: string,
    ): Promise<ContactMethod | undefined> {
      return db
        .updateTable("userContactMethods")
        .set({ type, value })
        .where("id", "=", id)
        .where("userId", "=", userId)
        .returning(["id", "type", "value"])
        .executeTakeFirst();
    },

    /** The reveal rows cascade away with the deleted method. */
    async deleteByIdForUser(id: string, userId: string): Promise<boolean> {
      const result = await db
        .deleteFrom("userContactMethods")
        .where("id", "=", id)
        .where("userId", "=", userId)
        .executeTakeFirst();
      return Number(result.numDeletedRows) > 0;
    },

    /** Ids the user doesn't own are ignored; methods missing from `ids` keep their old `sort_order`. */
    reorder(userId: string, ids: readonly string[]): Promise<void> {
      return reorderBySortOrder(db, {
        table: "userContactMethods",
        keyColumn: "id",
        keys: ids,
        keyType: "uuid",
        scope: sql<SqlBool>`${sql.ref("userContactMethods.userId")} = ${userId}`,
      });
    },
  };
}
