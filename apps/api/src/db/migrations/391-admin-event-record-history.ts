import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE admin_events
    SET new_values = coalesce(new_values, '{}'::jsonb) || jsonb_build_object('printingId', entity_id),
      entity_id = null
    WHERE action = 'image.add-url' AND entity_type = 'image' AND entity_id IS NOT NULL
      AND NOT coalesce(new_values ? 'printingId', false)
  `.execute(db);

  await sql`
    CREATE INDEX idx_admin_events_entity ON admin_events (entity_type, entity_id)
  `.execute(db);
  await sql`
    CREATE INDEX idx_admin_events_image_new_printing ON admin_events ((new_values ->> 'printingId'))
      WHERE entity_type = 'image'
  `.execute(db);
  await sql`
    CREATE INDEX idx_admin_events_image_old_printing ON admin_events ((old_values ->> 'printingId'))
      WHERE entity_type = 'image'
  `.execute(db);
  await sql`
    CREATE INDEX idx_admin_events_candidate_printing_ids
      ON admin_events USING gin ((new_values -> 'candidatePrintingIds'))
      WHERE entity_type = 'candidate-printing'
  `.execute(db);
  await sql`
    CREATE INDEX idx_admin_events_candidate_card_ids
      ON admin_events USING gin ((new_values -> 'candidateCardIds'))
      WHERE entity_type = 'candidate-card'
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX idx_admin_events_candidate_card_ids`.execute(db);
  await sql`DROP INDEX idx_admin_events_candidate_printing_ids`.execute(db);
  await sql`DROP INDEX idx_admin_events_image_old_printing`.execute(db);
  await sql`DROP INDEX idx_admin_events_image_new_printing`.execute(db);
  await sql`DROP INDEX idx_admin_events_entity`.execute(db);
}
