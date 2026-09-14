import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const table of ["candidate_cards", "candidate_printings"]) {
    await db.schema
      .alterTable(table)
      .addColumn("uploaded_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
      .execute();
    await sql`UPDATE ${sql.table(table)} SET uploaded_at = created_at`.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of ["candidate_cards", "candidate_printings"]) {
    await db.schema.alterTable(table).dropColumn("uploaded_at").execute();
  }
}
