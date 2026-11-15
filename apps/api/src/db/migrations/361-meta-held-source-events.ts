import type { Kysely } from "kysely";
import { sql } from "kysely";

// No backfill: the same-store match is a fuzzy name comparison in code, so held
// rows get their marker on the next auto-accept pass over them.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE meta_held_source_events (
      provider text NOT NULL,
      external_id text NOT NULL,
      meta_event_id uuid NOT NULL REFERENCES meta_events(id) ON DELETE CASCADE,
      held_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT meta_held_source_events_pkey PRIMARY KEY (provider, external_id),
      CONSTRAINT chk_meta_held_source_events_provider CHECK (provider <> ''),
      CONSTRAINT chk_meta_held_source_events_external_id CHECK (external_id <> '')
    )
  `.execute(db);
  await sql`
    CREATE INDEX idx_meta_held_source_events_meta_event_id
      ON meta_held_source_events (meta_event_id)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE meta_held_source_events`.execute(db);
}
