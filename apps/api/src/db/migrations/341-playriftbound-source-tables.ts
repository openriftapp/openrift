import type { Kysely } from "kysely";
import { sql } from "kysely";

// Organizer contact details and registrant Riot ID tag lines are never stored:
// the projection is the ceiling on what the archive can know.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE playriftbound_organizers (
      id text PRIMARY KEY,
      name text NOT NULL,
      city text,
      admin_area text,
      address text,
      latitude double precision,
      longitude double precision,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT chk_playriftbound_organizers_id CHECK (id <> ''),
      CONSTRAINT chk_playriftbound_organizers_name CHECK (length(name) BETWEEN 1 AND 200),
      CONSTRAINT chk_playriftbound_organizers_latitude
        CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
      CONSTRAINT chk_playriftbound_organizers_longitude
        CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
    )
  `.execute(db);

  await sql`
    CREATE TRIGGER trg_set_updated_at
      BEFORE UPDATE ON playriftbound_organizers
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `.execute(db);

  await sql`
    CREATE TABLE playriftbound_events (
      tournament_id text PRIMARY KEY,
      organizer_id text REFERENCES playriftbound_organizers(id) ON DELETE SET NULL,
      name text NOT NULL,
      start_at timestamptz NOT NULL,
      tournament_type text,
      format text,
      player_format text,
      participant_capacity integer,
      registered_count integer,
      waitlisted_count integer,
      pricing text,
      entry_fee_currency text,
      entry_fee_minor integer,
      content_hash text NOT NULL,
      first_seen_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL,
      missing_since timestamptz,
      structure text,
      match_format text,
      round_count integer,
      rounds_played integer,
      rounds_finalized integer,
      source_updated_at timestamptz,
      results_fetched_at timestamptz,
      CONSTRAINT chk_playriftbound_events_tournament_id CHECK (tournament_id ~ '^[0-9]+$'),
      CONSTRAINT chk_playriftbound_events_name CHECK (length(name) BETWEEN 1 AND 200),
      CONSTRAINT chk_playriftbound_events_content_hash CHECK (content_hash <> ''),
      CONSTRAINT chk_playriftbound_events_participant_capacity
        CHECK (participant_capacity IS NULL OR participant_capacity >= 0),
      CONSTRAINT chk_playriftbound_events_registered_count
        CHECK (registered_count IS NULL OR registered_count >= 0),
      CONSTRAINT chk_playriftbound_events_waitlisted_count
        CHECK (waitlisted_count IS NULL OR waitlisted_count >= 0),
      CONSTRAINT chk_playriftbound_events_entry_fee_minor
        CHECK (entry_fee_minor IS NULL OR entry_fee_minor >= 0),
      CONSTRAINT chk_playriftbound_events_round_count
        CHECK (round_count IS NULL OR round_count >= 0),
      CONSTRAINT chk_playriftbound_events_rounds_played
        CHECK (rounds_played IS NULL OR rounds_played >= 0),
      CONSTRAINT chk_playriftbound_events_rounds_finalized
        CHECK (rounds_finalized IS NULL OR rounds_finalized >= 0)
    )
  `.execute(db);

  await sql`CREATE INDEX idx_playriftbound_events_start ON playriftbound_events (start_at)`.execute(
    db,
  );
  await sql`
    CREATE INDEX idx_playriftbound_events_organizer ON playriftbound_events (organizer_id)
  `.execute(db);

  await sql`
    CREATE TABLE playriftbound_event_checks (
      tournament_id text PRIMARY KEY
        REFERENCES playriftbound_events(tournament_id) ON DELETE CASCADE,
      next_check_at timestamptz,
      check_stage smallint NOT NULL DEFAULT 0,
      failing_since timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT chk_playriftbound_event_checks_stage CHECK (check_stage >= 0)
    )
  `.execute(db);

  await sql`
    CREATE TRIGGER trg_set_updated_at
      BEFORE UPDATE ON playriftbound_event_checks
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `.execute(db);

  await sql`
    CREATE INDEX idx_playriftbound_event_checks_due ON playriftbound_event_checks (next_check_at)
      WHERE next_check_at IS NOT NULL
  `.execute(db);

  await sql`
    CREATE TABLE playriftbound_event_standings (
      tournament_id text NOT NULL
        REFERENCES playriftbound_events(tournament_id) ON DELETE CASCADE,
      team_id text NOT NULL,
      player_id text,
      player_name text NOT NULL,
      rank integer,
      wins smallint,
      losses smallint,
      draws smallint,
      match_points integer,
      opponent_match_win_pct double precision,
      game_win_pct double precision,
      opponent_game_win_pct double precision,
      entry_status text,
      fetched_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (tournament_id, team_id),
      CONSTRAINT chk_playriftbound_event_standings_team_id CHECK (team_id <> ''),
      CONSTRAINT chk_playriftbound_event_standings_player_name
        CHECK (length(player_name) BETWEEN 1 AND 80),
      CONSTRAINT chk_playriftbound_event_standings_rank CHECK (rank IS NULL OR rank >= 1),
      CONSTRAINT chk_playriftbound_event_standings_match_points
        CHECK (match_points IS NULL OR match_points >= 0),
      CONSTRAINT chk_playriftbound_event_standings_tiebreakers CHECK (
        (opponent_match_win_pct IS NULL OR opponent_match_win_pct BETWEEN 0 AND 1)
        AND (game_win_pct IS NULL OR game_win_pct BETWEEN 0 AND 1)
        AND (opponent_game_win_pct IS NULL OR opponent_game_win_pct BETWEEN 0 AND 1)
      ),
      CONSTRAINT chk_playriftbound_event_standings_entry_status
        CHECK (entry_status IS NULL OR entry_status IN ('complete', 'eliminated', 'dropped'))
    )
  `.execute(db);

  await sql`
    CREATE TABLE playriftbound_event_phases (
      tournament_id text NOT NULL
        REFERENCES playriftbound_events(tournament_id) ON DELETE CASCADE,
      phase_order integer NOT NULL,
      name text,
      round_type text NOT NULL,
      round_count integer,
      max_game_wins integer,
      PRIMARY KEY (tournament_id, phase_order),
      CONSTRAINT chk_playriftbound_event_phases_order CHECK (phase_order >= 0),
      CONSTRAINT chk_playriftbound_event_phases_round_type CHECK (round_type <> ''),
      CONSTRAINT chk_playriftbound_event_phases_round_count
        CHECK (round_count IS NULL OR round_count >= 0),
      CONSTRAINT chk_playriftbound_event_phases_max_game_wins
        CHECK (max_game_wins IS NULL OR max_game_wins >= 1)
    )
  `.execute(db);

  await sql`
    CREATE TABLE playriftbound_event_matches (
      tournament_id text NOT NULL
        REFERENCES playriftbound_events(tournament_id) ON DELETE CASCADE,
      source_match_id text NOT NULL,
      round_id text NOT NULL,
      phase_order integer NOT NULL DEFAULT 0,
      round_number integer NOT NULL,
      table_number integer,
      is_bye boolean NOT NULL DEFAULT false,
      is_draw boolean NOT NULL DEFAULT false,
      player1_team_id text NOT NULL,
      player2_team_id text,
      winner_team_id text,
      games_won_p1 smallint,
      games_won_p2 smallint,
      PRIMARY KEY (tournament_id, source_match_id),
      CONSTRAINT chk_playriftbound_event_matches_source_match_id CHECK (source_match_id <> ''),
      CONSTRAINT chk_playriftbound_event_matches_round_number CHECK (round_number >= 1),
      CONSTRAINT chk_playriftbound_event_matches_bye
        CHECK (NOT is_bye OR player2_team_id IS NULL)
    )
  `.execute(db);

  await sql`
    CREATE TABLE friend_group_playriftbound_shops (
      group_id uuid NOT NULL REFERENCES friend_groups(id) ON DELETE CASCADE,
      organizer_id text NOT NULL REFERENCES playriftbound_organizers(id) ON DELETE CASCADE,
      added_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (group_id, organizer_id)
    )
  `.execute(db);

  await sql`
    CREATE INDEX idx_friend_group_playriftbound_shops_organizer
      ON friend_group_playriftbound_shops (organizer_id)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE friend_group_playriftbound_shops`.execute(db);
  await sql`DROP TABLE playriftbound_event_matches`.execute(db);
  await sql`DROP TABLE playriftbound_event_phases`.execute(db);
  await sql`DROP TABLE playriftbound_event_standings`.execute(db);
  await sql`DROP TABLE playriftbound_event_checks`.execute(db);
  await sql`DROP TABLE playriftbound_events`.execute(db);
  await sql`DROP TABLE playriftbound_organizers`.execute(db);
}
