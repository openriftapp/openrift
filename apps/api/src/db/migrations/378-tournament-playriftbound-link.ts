import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE tournaments
      ADD COLUMN playriftbound_event_id text,
      ADD CONSTRAINT chk_tournaments_playriftbound_event_id
        CHECK (playriftbound_event_id IS NULL OR playriftbound_event_id ~ '^[1-9][0-9]{0,19}$')
  `.execute(db);
  await sql`
    ALTER TABLE tournament_participants
      ADD COLUMN external_id text,
      ADD COLUMN source_deck_saved_at timestamptz,
      ADD CONSTRAINT chk_tournament_participants_external_id
        CHECK (external_id IS NULL OR length(external_id) BETWEEN 1 AND 200)
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX uq_tournament_participants_external
      ON tournament_participants (tournament_id, external_id)
      WHERE external_id IS NOT NULL
  `.execute(db);
  await sql`
    CREATE INDEX idx_tournaments_playriftbound_event_id
      ON tournaments (playriftbound_event_id)
      WHERE playriftbound_event_id IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX idx_tournaments_playriftbound_event_id`.execute(db);
  await sql`DROP INDEX uq_tournament_participants_external`.execute(db);
  await sql`
    ALTER TABLE tournament_participants
      DROP COLUMN external_id,
      DROP COLUMN source_deck_saved_at
  `.execute(db);
  await sql`ALTER TABLE tournaments DROP COLUMN playriftbound_event_id`.execute(db);
}
