import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // An existing scoped pin already wins over the wildcard, so it is kept as is.
  await sql`
    INSERT INTO printing_link_overrides (external_id, finish, provider, printing_id, created_at)
    SELECT DISTINCT o.external_id, o.finish, cc.provider, o.printing_id, o.created_at
    FROM printing_link_overrides o
    JOIN candidate_printings cp
      ON cp.external_id = o.external_id AND COALESCE(cp.finish, '') = o.finish
    JOIN candidate_cards cc ON cc.id = cp.candidate_card_id
    WHERE o.provider = ''
    ON CONFLICT (external_id, finish, provider) DO NOTHING
  `.execute(db);
  await sql`DELETE FROM printing_link_overrides WHERE provider = ''`.execute(db);
  await sql`
    ALTER TABLE printing_link_overrides
      ADD CONSTRAINT chk_plo_no_empty_provider CHECK (provider <> '')
  `.execute(db);
}

// The deleted wildcard pins are not restored.
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE printing_link_overrides DROP CONSTRAINT chk_plo_no_empty_provider`.execute(
    db,
  );
}
