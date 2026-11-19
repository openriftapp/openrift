import type { Kysely, Selectable } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { ApiKeysTable } from "../../../db/tables/auth.js";

export type ApiKeyRow = Pick<
  Selectable<ApiKeysTable>,
  "id" | "name" | "start" | "permissions" | "createdAt" | "expiresAt" | "lastRequest"
>;

export function apiKeysRepo(db: Kysely<Database>) {
  return {
    async permissionsById(id: string): Promise<string | null> {
      const row = await db
        .selectFrom("apiKeys")
        .select("permissions")
        .where("id", "=", id)
        .executeTakeFirst();
      return row?.permissions ?? null;
    },

    /** Keys past `expiresAt` are left out; better-auth deletes them on their next use. */
    async listActiveForUser(userId: string, now: Date): Promise<ApiKeyRow[]> {
      return db
        .selectFrom("apiKeys")
        .select(["id", "name", "start", "permissions", "createdAt", "expiresAt", "lastRequest"])
        .where("referenceId", "=", userId)
        .where((eb) => eb.or([eb("expiresAt", "is", null), eb("expiresAt", ">", now)]))
        .orderBy("createdAt", "desc")
        .execute();
    },

    async deleteForUser(id: string, userId: string): Promise<boolean> {
      const result = await db
        .deleteFrom("apiKeys")
        .where("id", "=", id)
        .where("referenceId", "=", userId)
        .executeTakeFirst();
      return result.numDeletedRows > 0n;
    },
  };
}
