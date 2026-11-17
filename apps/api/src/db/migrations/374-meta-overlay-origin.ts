import type { Kysely } from "kysely";
import { sql } from "kysely";

// META_USER_SUBMISSION_PROVIDER and TOURNAMENT_LIST_PROVIDER: in-app submissions a person wrote.

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE meta_event_overlays ADD COLUMN origin text`.execute(db);
  await sql`ALTER TABLE meta_event_player_overlays ADD COLUMN origin text`.execute(db);

  await sql`ALTER TABLE meta_event_overlays DISABLE TRIGGER trg_set_updated_at`.execute(db);
  await sql`
    UPDATE meta_event_overlays o
       SET origin = CASE
         WHEN o.provider IN ('usersubmission', 'tournament') THEN 'contributor'
         WHEN o.provider IS NOT NULL THEN 'provider'
         WHEN EXISTS (SELECT 1 FROM meta_submissions s WHERE s.event_overlay_id = o.id)
           OR o.submission_note IS NOT NULL THEN 'contributor'
         ELSE 'admin_edit'
       END
  `.execute(db);
  await sql`ALTER TABLE meta_event_overlays ENABLE TRIGGER trg_set_updated_at`.execute(db);

  await sql`ALTER TABLE meta_event_player_overlays DISABLE TRIGGER trg_set_updated_at`.execute(db);
  await sql`
    UPDATE meta_event_player_overlays o
       SET origin = CASE
         WHEN o.provider IN ('usersubmission', 'tournament') THEN 'contributor'
         WHEN o.provider IS NOT NULL THEN 'provider'
         WHEN EXISTS (SELECT 1 FROM meta_submissions s WHERE s.player_overlay_id = o.id)
           OR o.submission_note IS NOT NULL THEN 'contributor'
         ELSE 'admin_edit'
       END
  `.execute(db);
  await sql`ALTER TABLE meta_event_player_overlays ENABLE TRIGGER trg_set_updated_at`.execute(db);

  for (const table of ["meta_event_overlays", "meta_event_player_overlays"]) {
    await sql`
      ALTER TABLE ${sql.ref(table)}
        ALTER COLUMN origin SET NOT NULL,
        ADD CONSTRAINT ${sql.ref(`chk_${table}_origin`)}
          CHECK (origin = ANY (ARRAY['admin_edit', 'contributor', 'provider']))
    `.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE meta_event_player_overlays DROP COLUMN origin`.execute(db);
  await sql`ALTER TABLE meta_event_overlays DROP COLUMN origin`.execute(db);
}
