import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`UPDATE card_types SET is_well_known = true WHERE slug = 'spell'`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`SET CONSTRAINTS trg_card_types_catalog_version IMMEDIATE`.execute(db);
  await sql`ALTER TABLE card_types DISABLE TRIGGER trg_card_types_protect_well_known`.execute(db);
  await sql`UPDATE card_types SET is_well_known = false WHERE slug = 'spell'`.execute(db);
  await sql`ALTER TABLE card_types ENABLE TRIGGER trg_card_types_protect_well_known`.execute(db);
  await sql`SET CONSTRAINTS trg_card_types_catalog_version DEFERRED`.execute(db);
}
