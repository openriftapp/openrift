import type { Kysely } from "kysely";
import { sql } from "kysely";

async function renameRuleKey(db: Kysely<unknown>, from: string, to: string): Promise<void> {
  const fromKey = sql.lit(from);
  const toKey = sql.lit(to);
  await sql`
    UPDATE lists
    SET rules = (
      SELECT jsonb_agg(
        CASE
          WHEN r ? ${fromKey} THEN (r - ${fromKey}) || jsonb_build_object(${toKey}, r->${fromKey})
          ELSE r
        END
        ORDER BY position
      )
      FROM jsonb_array_elements(rules) WITH ORDINALITY AS t(r, position)
    )
    WHERE jsonb_array_length(rules) > 0
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(rules) AS e(r) WHERE r ? ${fromKey})
  `.execute(db);
}

export async function up(db: Kysely<unknown>): Promise<void> {
  await renameRuleKey(db, "excludeCopyIds", "keepCopyIds");
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await renameRuleKey(db, "keepCopyIds", "excludeCopyIds");
}
