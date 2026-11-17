import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE cardmarket_sync_state`.execute(db);

  await sql`
    DROP INDEX
      idx_meta_credits_event,
      idx_tournament_groups_tournament,
      idx_uvsgames_events_store,
      idx_decks_user_id,
      idx_copy_deletions_user,
      idx_copy_deletions_group,
      idx_playloltcg_events_shop,
      idx_playloltcg_events_start
  `.execute(db);

  await sql`CREATE INDEX idx_meta_event_matches_player1 ON meta_event_matches (player1_id)`.execute(
    db,
  );
  await sql`
    CREATE INDEX idx_meta_event_matches_player2
      ON meta_event_matches (player2_id)
      WHERE player2_id IS NOT NULL
  `.execute(db);
  await sql`
    CREATE INDEX idx_meta_event_matches_winner
      ON meta_event_matches (winner_id)
      WHERE winner_id IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX
      idx_meta_event_matches_player1,
      idx_meta_event_matches_player2,
      idx_meta_event_matches_winner
  `.execute(db);

  await sql`CREATE INDEX idx_playloltcg_events_start ON playloltcg_events (start_at)`.execute(db);
  await sql`
    CREATE INDEX idx_playloltcg_events_shop ON playloltcg_events (shop_id) WHERE shop_id IS NOT NULL
  `.execute(db);
  await sql`CREATE INDEX idx_copy_deletions_group ON copy_deletions (group_id)`.execute(db);
  await sql`CREATE INDEX idx_copy_deletions_user ON copy_deletions (user_id)`.execute(db);
  await sql`CREATE INDEX idx_decks_user_id ON decks (user_id)`.execute(db);
  await sql`
    CREATE INDEX idx_uvsgames_events_store ON uvsgames_events (store_id) WHERE store_id IS NOT NULL
  `.execute(db);
  await sql`CREATE INDEX idx_tournament_groups_tournament ON tournament_groups (tournament_id)`.execute(
    db,
  );
  await sql`CREATE INDEX idx_meta_credits_event ON meta_credits (meta_event_id)`.execute(db);

  await sql`
    CREATE TABLE cardmarket_sync_state (
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      printing_id uuid NOT NULL REFERENCES printings(id) ON DELETE CASCADE,
      condition text NOT NULL REFERENCES conditions(slug),
      is_altered boolean NOT NULL,
      intent_base integer NOT NULL DEFAULT 0,
      observed_base integer NOT NULL DEFAULT 0,
      unmanaged integer NOT NULL DEFAULT 0,
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, printing_id, condition, is_altered),
      CONSTRAINT chk_cardmarket_sync_state_counts
        CHECK (intent_base >= 0 AND observed_base >= 0 AND unmanaged >= 0)
    )
  `.execute(db);
  await sql`CREATE INDEX idx_cardmarket_sync_state_user ON cardmarket_sync_state (user_id)`.execute(
    db,
  );
}
