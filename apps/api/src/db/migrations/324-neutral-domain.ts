import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`UPDATE domains SET sort_order = 7 WHERE slug = 'colorless'`.execute(db);
  await sql`
    INSERT INTO domains (slug, label, sort_order, is_well_known, color)
    VALUES ('neutral', 'Neutral', 6, TRUE, '#78716C')
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // protect_well_known blocks deleting a well-known row.
  await sql`ALTER TABLE domains DISABLE TRIGGER trg_domains_protect_well_known`.execute(db);
  await sql`DELETE FROM domains WHERE slug = 'neutral'`.execute(db);
  await sql`ALTER TABLE domains ENABLE TRIGGER trg_domains_protect_well_known`.execute(db);
  await sql`UPDATE domains SET sort_order = 6 WHERE slug = 'colorless'`.execute(db);
}
