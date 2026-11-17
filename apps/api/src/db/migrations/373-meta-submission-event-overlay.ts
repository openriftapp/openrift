import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE meta_submissions
      ADD COLUMN event_overlay_id uuid,
      ADD CONSTRAINT fk_meta_submissions_event_overlay_id
        FOREIGN KEY (event_overlay_id) REFERENCES meta_event_overlays(id) ON DELETE SET NULL
  `.execute(db);

  // The apply stamped the overlay's accepted_at and the submission's resolved_at from one clock reading.
  await sql`ALTER TABLE meta_submissions DISABLE TRIGGER trg_set_updated_at`.execute(db);
  await sql`
    UPDATE meta_submissions s
       SET event_overlay_id = matched.overlay_id
      FROM (
        SELECT DISTINCT ON (s2.id) s2.id AS submission_id, o.id AS overlay_id
          FROM meta_submissions s2
          JOIN meta_event_overlays o
            ON o.submitted_by_user_id = s2.user_id
           AND o.meta_event_id = s2.meta_event_id
           AND date_trunc('milliseconds', o.accepted_at) = date_trunc('milliseconds', s2.resolved_at)
         WHERE s2.kind = 'event_correction'
           AND s2.status = 'accepted'
         ORDER BY s2.id, o.id
      ) matched
     WHERE s.id = matched.submission_id
  `.execute(db);
  await sql`ALTER TABLE meta_submissions ENABLE TRIGGER trg_set_updated_at`.execute(db);

  await sql`
    CREATE INDEX idx_meta_submissions_event_overlay
      ON meta_submissions (event_overlay_id)
      WHERE event_overlay_id IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE meta_submissions DROP COLUMN event_overlay_id`.execute(db);
}
