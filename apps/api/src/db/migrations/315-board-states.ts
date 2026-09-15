import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE board_states (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title text NOT NULL,
      answer text,
      core_rules_version text,
      tournament_rules_version text,
      document jsonb NOT NULL,
      is_public boolean NOT NULL DEFAULT false,
      share_token text,
      is_featured boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT board_states_share_token_key UNIQUE (share_token),
      CONSTRAINT chk_board_states_title_not_empty CHECK (title <> ''),
      CONSTRAINT chk_board_states_rules_pinned CHECK (
        core_rules_version IS NOT NULL OR tournament_rules_version IS NOT NULL
      ),
      CONSTRAINT chk_board_states_document_object CHECK (jsonb_typeof(document) = 'object')
    )
  `.execute(db);

  await sql`
    CREATE INDEX idx_board_states_user_updated ON board_states (user_id, updated_at DESC)
  `.execute(db);

  await sql`
    CREATE INDEX idx_board_states_featured ON board_states (updated_at DESC) WHERE is_featured
  `.execute(db);

  // The share image's `?v=` cache-bust reads updated_at, so it must advance on every edit.
  await sql`
    CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON board_states
    FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE board_states`.execute(db);
}
