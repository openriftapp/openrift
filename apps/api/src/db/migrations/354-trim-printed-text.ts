import type { Kysely } from "kysely";
import { sql } from "kysely";

function trimmed(column: string) {
  return sql`regexp_replace(${sql.ref(column)}, '^[[:space:]]+|[[:space:]]+$', '', 'g')`;
}

async function trimNullable(db: Kysely<unknown>, table: string, columns: readonly string[]) {
  for (const column of columns) {
    await sql`
      UPDATE ${sql.table(table)}
      SET ${sql.ref(column)} = nullif(${trimmed(column)}, '')
      WHERE ${sql.ref(column)} IS DISTINCT FROM nullif(${trimmed(column)}, '')
    `.execute(db);
  }
}

export async function up(db: Kysely<unknown>): Promise<void> {
  // artist is NOT NULL: a whitespace-only one is left for an admin to fix.
  await sql`
    UPDATE faces SET artist = ${trimmed("artist")}
    WHERE artist <> ${trimmed("artist")} AND ${trimmed("artist")} <> ''
  `.execute(db);
  await trimNullable(db, "faces", [
    "printed_name",
    "printed_rules_text",
    "printed_effect_text",
    "flavor_text",
  ]);
  await trimNullable(db, "candidate_printings", [
    "artist",
    "printed_name",
    "printed_rules_text",
    "printed_effect_text",
    "flavor_text",
  ]);
  await trimNullable(db, "candidate_cards", ["rules_text", "effect_text"]);
}

// oxlint-disable-next-line eslint/no-empty-function -- the stripped whitespace carries no meaning to restore
export async function down(): Promise<void> {}
