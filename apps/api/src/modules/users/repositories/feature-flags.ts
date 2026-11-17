import type { Kysely, Selectable } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { FeatureFlagsTable } from "../../../db/tables/settings.js";

export function featureFlagsRepo(db: Kysely<Database>) {
  return {
    listKeyEnabled(): Promise<{ key: string; enabled: boolean }[]> {
      return db.selectFrom("featureFlags").select(["key", "isEnabled as enabled"]).execute();
    },

    async isEnabled(key: string): Promise<boolean | undefined> {
      const row = await db
        .selectFrom("featureFlags")
        .select("isEnabled as enabled")
        .where("key", "=", key)
        .executeTakeFirst();
      return row?.enabled;
    },

    listAll(): Promise<Selectable<FeatureFlagsTable>[]> {
      return db.selectFrom("featureFlags").selectAll().orderBy("key").execute();
    },

    create(values: {
      key: string;
      enabled: boolean;
      description: string | null;
    }): Promise<Selectable<FeatureFlagsTable> | undefined> {
      return db
        .insertInto("featureFlags")
        .values({ key: values.key, isEnabled: values.enabled, description: values.description })
        .onConflict((oc) => oc.column("key").doNothing())
        .returningAll()
        .executeTakeFirst();
    },

    update(
      key: string,
      updates: { enabled?: boolean; description?: string | null },
    ): Promise<Selectable<FeatureFlagsTable> | undefined> {
      return db
        .updateTable("featureFlags")
        .set({ isEnabled: updates.enabled, description: updates.description })
        .where("key", "=", key)
        .returningAll()
        .executeTakeFirst();
    },

    async deleteByKey(key: string): Promise<boolean> {
      const result = await db.deleteFrom("featureFlags").where("key", "=", key).executeTakeFirst();
      return result.numDeletedRows > 0n;
    },
  };
}
