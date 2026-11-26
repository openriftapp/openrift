import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE meta_events
      ADD COLUMN player_row_count integer NOT NULL DEFAULT 0,
      ADD COLUMN deck_count integer NOT NULL DEFAULT 0,
      ADD CONSTRAINT chk_meta_events_player_row_count CHECK (player_row_count >= 0),
      ADD CONSTRAINT chk_meta_events_deck_count CHECK (deck_count >= 0 AND deck_count <= player_row_count)
  `.execute(db);

  // Signed deltas, never a recount: a concurrent writer's rows are not in this snapshot.
  await sql`
    CREATE FUNCTION apply_meta_event_count_deltas() RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        event_ids uuid[];
        player_deltas integer[];
        deck_deltas integer[];
      BEGIN
        IF TG_OP = 'INSERT' THEN
          SELECT array_agg(id), array_agg(players), array_agg(decks)
            INTO event_ids, player_deltas, deck_deltas
            FROM (SELECT meta_event_id AS id, count(*)::int AS players, count(deck_id)::int AS decks
                    FROM new_rows GROUP BY meta_event_id) d;
        ELSIF TG_OP = 'DELETE' THEN
          SELECT array_agg(id), array_agg(players), array_agg(decks)
            INTO event_ids, player_deltas, deck_deltas
            FROM (SELECT meta_event_id AS id, -count(*)::int AS players, -count(deck_id)::int AS decks
                    FROM old_rows GROUP BY meta_event_id) d;
        ELSE
          SELECT array_agg(id), array_agg(players), array_agg(decks)
            INTO event_ids, player_deltas, deck_deltas
            FROM (SELECT id, sum(players)::int AS players, sum(decks)::int AS decks
                    FROM (SELECT meta_event_id AS id, 1 AS players, (deck_id IS NOT NULL)::int AS decks
                            FROM new_rows
                          UNION ALL
                          SELECT meta_event_id, -1, -(deck_id IS NOT NULL)::int FROM old_rows) changes
                   GROUP BY id
                  HAVING sum(players) <> 0 OR sum(decks) <> 0) d;
        END IF;

        IF event_ids IS NULL THEN
          RETURN NULL;
        END IF;

        PERFORM 1 FROM meta_events WHERE id = ANY(event_ids) ORDER BY id FOR NO KEY UPDATE;
        UPDATE meta_events me
          SET player_row_count = me.player_row_count + d.players,
              deck_count = me.deck_count + d.decks
          FROM unnest(event_ids, player_deltas, deck_deltas) AS d(id, players, decks)
          WHERE me.id = d.id;
        RETURN NULL;
      END;
      $$
  `.execute(db);
  await sql`
    CREATE TRIGGER trg_meta_event_players_counts_insert
      AFTER INSERT ON meta_event_players
      REFERENCING NEW TABLE AS new_rows
      FOR EACH STATEMENT EXECUTE FUNCTION apply_meta_event_count_deltas()
  `.execute(db);
  await sql`
    CREATE TRIGGER trg_meta_event_players_counts_update
      AFTER UPDATE ON meta_event_players
      REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
      FOR EACH STATEMENT EXECUTE FUNCTION apply_meta_event_count_deltas()
  `.execute(db);
  await sql`
    CREATE TRIGGER trg_meta_event_players_counts_delete
      AFTER DELETE ON meta_event_players
      REFERENCING OLD TABLE AS old_rows
      FOR EACH STATEMENT EXECUTE FUNCTION apply_meta_event_count_deltas()
  `.execute(db);

  // The backfill is not an edit: it must not move every event's sitemap lastmod.
  await sql`ALTER TABLE meta_events DISABLE TRIGGER trg_set_updated_at`.execute(db);
  await sql`
    UPDATE meta_events me
      SET player_row_count = c.players, deck_count = c.decks
      FROM (
        SELECT meta_event_id, count(*)::int AS players, count(deck_id)::int AS decks
        FROM meta_event_players
        GROUP BY meta_event_id
      ) c
      WHERE c.meta_event_id = me.id
  `.execute(db);
  await sql`ALTER TABLE meta_events ENABLE TRIGGER trg_set_updated_at`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TRIGGER trg_meta_event_players_counts_delete ON meta_event_players`.execute(db);
  await sql`DROP TRIGGER trg_meta_event_players_counts_update ON meta_event_players`.execute(db);
  await sql`DROP TRIGGER trg_meta_event_players_counts_insert ON meta_event_players`.execute(db);
  await sql`DROP FUNCTION apply_meta_event_count_deltas()`.execute(db);
  await sql`
    ALTER TABLE meta_events
      DROP CONSTRAINT chk_meta_events_deck_count,
      DROP CONSTRAINT chk_meta_events_player_row_count,
      DROP COLUMN deck_count,
      DROP COLUMN player_row_count
  `.execute(db);
}
