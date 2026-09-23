import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE cards
      ADD COLUMN additional_legend_count smallint CHECK (additional_legend_count > 0)
  `.execute(db);
  await sql`UPDATE deck_zones SET sort_order = sort_order + 1 WHERE sort_order >= 1`.execute(db);
  await sql`
    INSERT INTO deck_zones (slug, label, sort_order, is_well_known)
    VALUES ('legend-options', 'Legend Options', 1, TRUE)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DELETE FROM deck_cards WHERE zone = 'legend-options'`.execute(db);
  await sql`DELETE FROM deck_check_entry_cards WHERE zone = 'legend-options'`.execute(db);
  // protect_well_known blocks deleting a well-known row.
  await sql`ALTER TABLE deck_zones DISABLE TRIGGER trg_deck_zones_protect_well_known`.execute(db);
  await sql`DELETE FROM deck_zones WHERE slug = 'legend-options'`.execute(db);
  await sql`ALTER TABLE deck_zones ENABLE TRIGGER trg_deck_zones_protect_well_known`.execute(db);
  await sql`UPDATE deck_zones SET sort_order = sort_order - 1 WHERE sort_order > 1`.execute(db);
  await sql`ALTER TABLE cards DROP COLUMN IF EXISTS additional_legend_count`.execute(db);
}
