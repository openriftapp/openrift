import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const table of ["candidate_cards", "candidate_printings"]) {
    await sql`
      ALTER TABLE ${sql.table(table)}
        ADD COLUMN dismissed_values jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD CONSTRAINT ${sql.ref(`chk_${table}_dismissed_values_shape`)}
          CHECK (jsonb_typeof(dismissed_values) = 'object')
    `.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of ["candidate_cards", "candidate_printings"]) {
    await sql`ALTER TABLE ${sql.table(table)} DROP COLUMN dismissed_values`.execute(db);
  }
}
