import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE deck_families (
      id uuid PRIMARY KEY,
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT chk_deck_families_name_not_empty CHECK (name <> '')
    )
  `.execute(db);
  await sql`CREATE INDEX idx_deck_families_user_id ON deck_families (user_id)`.execute(db);
  await sql`
    CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON deck_families
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `.execute(db);
  await sql`
    INSERT INTO deck_families (id, user_id)
    SELECT DISTINCT family_id, user_id FROM decks WHERE family_id IS NOT NULL
  `.execute(db);
  await sql`
    ALTER TABLE decks ADD CONSTRAINT decks_family_id_fkey
      FOREIGN KEY (family_id) REFERENCES deck_families(id)
  `.execute(db);

  await sql`
    CREATE FUNCTION set_deck_updated_stamps() RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF (to_jsonb(NEW) - 'updated_at' - 'updated_xid' - 'family_id' - 'is_primary' - 'predecessor_deck_id')
           IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'updated_xid' - 'family_id' - 'is_primary' - 'predecessor_deck_id') THEN
          NEW.updated_at := now();
        END IF;
        IF (to_jsonb(NEW) - 'updated_xid') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_xid') THEN
          NEW.updated_xid := pg_current_xact_id();
        END IF;
        RETURN NEW;
      END;
      $$
  `.execute(db);
  await sql`DROP TRIGGER trg_set_updated_stamps ON decks`.execute(db);
  await sql`
    CREATE TRIGGER trg_set_updated_stamps BEFORE UPDATE ON decks
      FOR EACH ROW EXECUTE FUNCTION set_deck_updated_stamps()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TRIGGER trg_set_updated_stamps ON decks`.execute(db);
  await sql`
    CREATE TRIGGER trg_set_updated_stamps BEFORE UPDATE ON decks
      FOR EACH ROW EXECUTE FUNCTION set_updated_stamps()
  `.execute(db);
  await sql`DROP FUNCTION set_deck_updated_stamps()`.execute(db);
  await sql`ALTER TABLE decks DROP CONSTRAINT decks_family_id_fkey`.execute(db);
  await sql`DROP TABLE deck_families`.execute(db);
}
