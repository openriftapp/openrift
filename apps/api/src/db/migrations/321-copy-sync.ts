import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE copies ADD COLUMN updated_xid xid8 NOT NULL DEFAULT pg_current_xact_id()`.execute(
    db,
  );
  await sql`ALTER TABLE decks ADD COLUMN updated_xid xid8 NOT NULL DEFAULT pg_current_xact_id()`.execute(
    db,
  );

  // The touch triggers below move only updated_xid; that must not read as an edit.
  await sql`
    CREATE FUNCTION set_updated_stamps() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF (to_jsonb(NEW) - 'updated_at' - 'updated_xid')
         IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'updated_xid') THEN
        NEW.updated_at := now();
      END IF;
      IF (to_jsonb(NEW) - 'updated_xid') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_xid') THEN
        NEW.updated_xid := pg_current_xact_id();
      END IF;
      RETURN NEW;
    END;
    $$
  `.execute(db);

  await sql`DROP TRIGGER trg_set_updated_at ON copies`.execute(db);
  await sql`
    CREATE TRIGGER trg_set_updated_stamps BEFORE UPDATE ON copies
    FOR EACH ROW EXECUTE FUNCTION set_updated_stamps()
  `.execute(db);
  await sql`DROP TRIGGER trg_set_updated_at ON decks`.execute(db);
  await sql`
    CREATE TRIGGER trg_set_updated_stamps BEFORE UPDATE ON decks
    FOR EACH ROW EXECUTE FUNCTION set_updated_stamps()
  `.execute(db);

  await sql`CREATE INDEX idx_copies_updated_xid ON copies (updated_xid, id)`.execute(db);
  await sql`CREATE INDEX idx_decks_user_updated_xid ON decks (user_id, updated_xid)`.execute(db);

  // No FK on collection_id, and user_id/group_id are snapshotted: a tombstone
  // outlives the collection it names.
  await sql`
    CREATE TABLE copy_deletions (
      copy_id uuid PRIMARY KEY,
      collection_id uuid NOT NULL,
      user_id text,
      group_id uuid,
      deleted_at timestamptz NOT NULL DEFAULT now(),
      deleted_xid xid8 NOT NULL DEFAULT pg_current_xact_id()
    )
  `.execute(db);

  await sql`CREATE INDEX idx_copy_deletions_xid ON copy_deletions (deleted_xid, copy_id)`.execute(
    db,
  );
  await sql`CREATE INDEX idx_copy_deletions_deleted_at ON copy_deletions (deleted_at)`.execute(db);
  await sql`CREATE INDEX idx_copy_deletions_user ON copy_deletions (user_id)`.execute(db);
  await sql`CREATE INDEX idx_copy_deletions_group ON copy_deletions (group_id)`.execute(db);

  // An add may reuse a copy id the client already disposed, and a cascade drops
  // the collection first, leaving the owner readable only from the tombstone.
  await sql`
    CREATE FUNCTION trg_copies_record_deletion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      owner_id text;
      owning_group_id uuid;
    BEGIN
      SELECT c.user_id, c.group_id INTO owner_id, owning_group_id
        FROM collections c WHERE c.id = OLD.collection_id;
      IF FOUND THEN
        INSERT INTO copy_deletions (copy_id, collection_id, user_id, group_id, deleted_at, deleted_xid)
        VALUES (OLD.id, OLD.collection_id, owner_id, owning_group_id, now(), pg_current_xact_id())
        ON CONFLICT (copy_id) DO UPDATE
          SET collection_id = EXCLUDED.collection_id,
              user_id = EXCLUDED.user_id,
              group_id = EXCLUDED.group_id,
              deleted_at = EXCLUDED.deleted_at,
              deleted_xid = EXCLUDED.deleted_xid
          WHERE copy_deletions.deleted_xid <> pg_current_xact_id();
      ELSE
        INSERT INTO copy_deletions (copy_id, collection_id, deleted_at, deleted_xid)
        VALUES (OLD.id, OLD.collection_id, now(), pg_current_xact_id())
        ON CONFLICT (copy_id) DO UPDATE
          SET deleted_at = EXCLUDED.deleted_at,
              deleted_xid = EXCLUDED.deleted_xid
          WHERE copy_deletions.deleted_xid <> pg_current_xact_id();
      END IF;
      RETURN OLD;
    END;
    $$
  `.execute(db);

  // The bulk wipe deletes by subquery, passing no id list a repository could
  // write tombstones from.
  await sql`
    CREATE TRIGGER copies_record_deletion AFTER DELETE ON copies
    FOR EACH ROW EXECUTE FUNCTION trg_copies_record_deletion()
  `.execute(db);

  // Runs before the cascade reaches copies, which is the only point where a
  // deleted collection's owner is still readable.
  await sql`
    CREATE FUNCTION trg_collections_record_copy_deletions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      INSERT INTO copy_deletions (copy_id, collection_id, user_id, group_id, deleted_at, deleted_xid)
      SELECT cp.id, OLD.id, OLD.user_id, OLD.group_id, now(), pg_current_xact_id()
        FROM copies cp WHERE cp.collection_id = OLD.id
      ON CONFLICT (copy_id) DO UPDATE
        SET collection_id = EXCLUDED.collection_id,
            user_id = EXCLUDED.user_id,
            group_id = EXCLUDED.group_id,
            deleted_at = EXCLUDED.deleted_at,
            deleted_xid = EXCLUDED.deleted_xid;
      RETURN OLD;
    END;
    $$
  `.execute(db);

  await sql`
    CREATE TRIGGER collections_record_copy_deletions BEFORE DELETE ON collections
    FOR EACH ROW EXECUTE FUNCTION trg_collections_record_copy_deletions()
  `.execute(db);

  // A move out of a viewer's scope deletes nothing, so without a tombstone the
  // delta stops matching the row and the old owner keeps it forever.
  await sql`
    CREATE FUNCTION trg_copies_record_scope_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      old_owner text;
      old_group uuid;
      new_owner text;
      new_group uuid;
    BEGIN
      SELECT c.user_id, c.group_id INTO old_owner, old_group
        FROM collections c WHERE c.id = OLD.collection_id;
      SELECT c.user_id, c.group_id INTO new_owner, new_group
        FROM collections c WHERE c.id = NEW.collection_id;
      IF (old_owner, old_group) IS DISTINCT FROM (new_owner, new_group) THEN
        INSERT INTO copy_deletions (copy_id, collection_id, user_id, group_id, deleted_at, deleted_xid)
        VALUES (OLD.id, OLD.collection_id, old_owner, old_group, now(), pg_current_xact_id())
        ON CONFLICT (copy_id) DO UPDATE
          SET collection_id = EXCLUDED.collection_id,
              user_id = EXCLUDED.user_id,
              group_id = EXCLUDED.group_id,
              deleted_at = EXCLUDED.deleted_at,
              deleted_xid = EXCLUDED.deleted_xid;
      END IF;
      RETURN NULL;
    END;
    $$
  `.execute(db);

  await sql`
    CREATE TRIGGER copies_record_scope_change AFTER UPDATE OF collection_id ON copies
    FOR EACH ROW WHEN (OLD.collection_id IS DISTINCT FROM NEW.collection_id)
    EXECUTE FUNCTION trg_copies_record_scope_change()
  `.execute(db);

  // onLoan and reserved are derived from these tables, and cascades and the
  // group-delete trigger clear a pin with no repository call to stamp the copy.
  await sql`
    CREATE FUNCTION trg_touch_pinned_copy() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      UPDATE copies SET updated_xid = pg_current_xact_id()
        WHERE id = COALESCE(NEW.copy_id, OLD.copy_id)
          AND updated_xid <> pg_current_xact_id();
      RETURN NULL;
    END;
    $$
  `.execute(db);

  await sql`
    CREATE TRIGGER loan_copies_touch_copy AFTER INSERT OR DELETE ON loan_copies
    FOR EACH ROW EXECUTE FUNCTION trg_touch_pinned_copy()
  `.execute(db);
  await sql`
    CREATE TRIGGER card_trade_copies_touch_copy AFTER INSERT OR DELETE ON card_trade_copies
    FOR EACH ROW EXECUTE FUNCTION trg_touch_pinned_copy()
  `.execute(db);

  // The deck-cards delta keys on the deck, so a card row changed without the
  // deck row (an admin printing deletion nulls preferred_printing_id) is invisible.
  await sql`
    CREATE FUNCTION trg_touch_deck_of_card() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      UPDATE decks SET updated_xid = pg_current_xact_id()
        WHERE id = COALESCE(NEW.deck_id, OLD.deck_id)
          AND updated_xid <> pg_current_xact_id();
      RETURN NULL;
    END;
    $$
  `.execute(db);

  await sql`
    CREATE TRIGGER deck_cards_touch_deck AFTER INSERT OR UPDATE OR DELETE ON deck_cards
    FOR EACH ROW EXECUTE FUNCTION trg_touch_deck_of_card()
  `.execute(db);

  // Single row. A watermark at or below pruned_through_xid predates tombstones
  // the sweep dropped, so its delta would miss deletions and must take a full read.
  await sql`
    CREATE TABLE copy_deletion_sweep (
      only_row boolean PRIMARY KEY DEFAULT true CHECK (only_row),
      pruned_through_xid xid8 NOT NULL DEFAULT '0'::xid8
    )
  `.execute(db);
  await sql`INSERT INTO copy_deletion_sweep (only_row) VALUES (true)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE copy_deletion_sweep`.execute(db);
  await sql`DROP TRIGGER deck_cards_touch_deck ON deck_cards`.execute(db);
  await sql`DROP FUNCTION trg_touch_deck_of_card()`.execute(db);
  await sql`DROP TRIGGER card_trade_copies_touch_copy ON card_trade_copies`.execute(db);
  await sql`DROP TRIGGER loan_copies_touch_copy ON loan_copies`.execute(db);
  await sql`DROP FUNCTION trg_touch_pinned_copy()`.execute(db);
  await sql`DROP TRIGGER collections_record_copy_deletions ON collections`.execute(db);
  await sql`DROP FUNCTION trg_collections_record_copy_deletions()`.execute(db);
  await sql`DROP TRIGGER copies_record_scope_change ON copies`.execute(db);
  await sql`DROP FUNCTION trg_copies_record_scope_change()`.execute(db);
  await sql`DROP TRIGGER copies_record_deletion ON copies`.execute(db);
  await sql`DROP FUNCTION trg_copies_record_deletion()`.execute(db);
  await sql`DROP TABLE copy_deletions`.execute(db);
  await sql`DROP INDEX idx_decks_user_updated_xid`.execute(db);
  await sql`DROP INDEX idx_copies_updated_xid`.execute(db);

  await sql`DROP TRIGGER trg_set_updated_stamps ON decks`.execute(db);
  await sql`
    CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON decks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `.execute(db);
  await sql`DROP TRIGGER trg_set_updated_stamps ON copies`.execute(db);
  await sql`
    CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON copies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `.execute(db);
  await sql`DROP FUNCTION set_updated_stamps()`.execute(db);

  await sql`ALTER TABLE decks DROP COLUMN updated_xid`.execute(db);
  await sql`ALTER TABLE copies DROP COLUMN updated_xid`.execute(db);
}
