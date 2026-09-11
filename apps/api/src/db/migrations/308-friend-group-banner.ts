import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * Group banners: an admin-uploaded image behind the group hero, stored under
 * `media/group-banners/` and referenced by URL. `banner_position` is the
 * vertical crop focus (0-100, percent from the top), matching the deck-cover
 * convention. The uploader columns exist for the admin moderation page.
 *
 * @returns Resolves once the columns and constraints exist.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE friend_groups
      ADD COLUMN banner_url text,
      ADD COLUMN banner_position smallint NOT NULL DEFAULT 50,
      ADD COLUMN banner_uploaded_by text REFERENCES users (id) ON DELETE SET NULL,
      ADD COLUMN banner_uploaded_at timestamptz,
      ADD CONSTRAINT chk_friend_groups_banner_url CHECK (
        banner_url IS NULL OR banner_url ~ '^/media/group-banners/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.webp$'
      ),
      ADD CONSTRAINT chk_friend_groups_banner_position CHECK (
        banner_position BETWEEN 0 AND 100
      );

    CREATE INDEX idx_friend_groups_banner_uploaded_at
      ON friend_groups (banner_uploaded_at DESC)
      WHERE banner_url IS NOT NULL
  `.execute(db);
}

/** @returns Resolves once the columns and index are dropped. */
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS idx_friend_groups_banner_uploaded_at;
    ALTER TABLE friend_groups
      DROP COLUMN IF EXISTS banner_uploaded_at,
      DROP COLUMN IF EXISTS banner_uploaded_by,
      DROP COLUMN IF EXISTS banner_position,
      DROP COLUMN IF EXISTS banner_url
  `.execute(db);
}
