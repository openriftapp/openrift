import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    INSERT INTO deck_formats (slug, label, sort_order, is_well_known)
    VALUES ('infinity', 'Infinity', (SELECT max(sort_order) + 1 FROM deck_formats), true)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE deck_formats DISABLE TRIGGER trg_deck_formats_protect_well_known`.execute(
    db,
  );
  await sql`DELETE FROM deck_formats WHERE slug = 'infinity'`.execute(db);
  await sql`ALTER TABLE deck_formats ENABLE TRIGGER trg_deck_formats_protect_well_known`.execute(
    db,
  );
}
