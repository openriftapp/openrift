import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`UPDATE card_types SET is_well_known = true WHERE slug = 'spell'`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`UPDATE card_types SET is_well_known = false WHERE slug = 'spell'`.execute(db);
}
