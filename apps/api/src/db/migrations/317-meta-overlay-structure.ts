import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * Brackets through the generic ingest. `meta_event_phases` and
 * `meta_event_matches` could only be written from the uvsgames mirror, so an
 * upload carried standings and decklists but no structure. These two tables
 * give an upload the same reach, matches keyed by the upload's own player
 * external ids and resolved to live player rows at promote time.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE meta_event_overlay_phases (
      event_overlay_id uuid NOT NULL REFERENCES meta_event_overlays(id) ON DELETE CASCADE,
      phase_order integer NOT NULL,
      name text,
      round_type text NOT NULL,
      round_count integer,
      rank_required integer,
      max_game_wins smallint,
      PRIMARY KEY (event_overlay_id, phase_order),
      CONSTRAINT chk_meta_event_overlay_phases_phase_order CHECK (phase_order >= 0),
      CONSTRAINT chk_meta_event_overlay_phases_name
        CHECK (name IS NULL OR length(name) BETWEEN 1 AND 120),
      CONSTRAINT chk_meta_event_overlay_phases_round_type CHECK (round_type <> ''),
      CONSTRAINT chk_meta_event_overlay_phases_round_count
        CHECK (round_count IS NULL OR round_count > 0),
      CONSTRAINT chk_meta_event_overlay_phases_rank_required
        CHECK (rank_required IS NULL OR rank_required > 0),
      CONSTRAINT chk_meta_event_overlay_phases_max_game_wins
        CHECK (max_game_wins IS NULL OR max_game_wins > 0)
    )
  `.execute(db);

  await sql`
    CREATE TABLE meta_event_overlay_matches (
      event_overlay_id uuid NOT NULL REFERENCES meta_event_overlays(id) ON DELETE CASCADE,
      external_id text NOT NULL,
      phase_order integer NOT NULL DEFAULT 0,
      round_number integer NOT NULL,
      round_external_id text,
      table_number integer,
      is_bye boolean NOT NULL DEFAULT false,
      is_draw boolean NOT NULL DEFAULT false,
      player1_external_id text NOT NULL,
      player2_external_id text,
      winner_external_id text,
      games_won_p1 integer,
      games_won_p2 integer,
      PRIMARY KEY (event_overlay_id, external_id),
      CONSTRAINT chk_meta_event_overlay_matches_external_id CHECK (external_id <> ''),
      CONSTRAINT chk_meta_event_overlay_matches_phase_order CHECK (phase_order >= 0),
      CONSTRAINT chk_meta_event_overlay_matches_round_number CHECK (round_number > 0),
      CONSTRAINT chk_meta_event_overlay_matches_round_external_id
        CHECK (round_external_id IS NULL OR round_external_id <> ''),
      CONSTRAINT chk_meta_event_overlay_matches_table_number
        CHECK (table_number IS NULL OR table_number > 0),
      CONSTRAINT chk_meta_event_overlay_matches_player1 CHECK (player1_external_id <> ''),
      CONSTRAINT chk_meta_event_overlay_matches_player2
        CHECK (player2_external_id IS NULL OR player2_external_id <> ''),
      CONSTRAINT chk_meta_event_overlay_matches_winner
        CHECK (winner_external_id IS NULL OR winner_external_id <> ''),
      CONSTRAINT chk_meta_event_overlay_matches_games
        CHECK ((games_won_p1 IS NULL OR games_won_p1 >= 0)
           AND (games_won_p2 IS NULL OR games_won_p2 >= 0)),
      -- A bye has no opponent and no draw; anything else has both seats named.
      CONSTRAINT chk_meta_event_overlay_matches_bye
        CHECK (CASE WHEN is_bye THEN player2_external_id IS NULL AND NOT is_draw
                    ELSE player2_external_id IS NOT NULL END),
      CONSTRAINT chk_meta_event_overlay_matches_winner_seat
        CHECK (winner_external_id IS NULL
               OR winner_external_id = player1_external_id
               OR (player2_external_id IS NOT NULL
                   AND winner_external_id = player2_external_id))
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE meta_event_overlay_matches`.execute(db);
  await sql`DROP TABLE meta_event_overlay_phases`.execute(db);
}
