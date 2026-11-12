import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE image_files
      DROP CONSTRAINT chk_image_files_rehosted_url,
      ADD CONSTRAINT chk_image_files_rehosted_url
        CHECK (rehosted_url = '/media/cards/' || right(id::text, 2) || '/' || id::text)
  `.execute(db);

  await sql`
    ALTER TABLE face_images
      ADD COLUMN activate_when_rehosted boolean NOT NULL DEFAULT false,
      ADD CONSTRAINT chk_face_images_pending_inactive
        CHECK (NOT (is_active AND activate_when_rehosted))
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX idx_face_images_pending ON face_images (face_id)
      WHERE activate_when_rehosted
  `.execute(db);

  await sql`
    CREATE TABLE image_rehost_failures (
      image_file_id uuid PRIMARY KEY REFERENCES image_files(id) ON DELETE CASCADE,
      attempts integer NOT NULL CONSTRAINT chk_image_rehost_failures_attempts CHECK (attempts > 0),
      last_error text NOT NULL CONSTRAINT chk_image_rehost_failures_last_error CHECK (last_error <> ''),
      last_attempt_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE VIEW public_image_files AS
      SELECT id, credit FROM image_files WHERE rehosted_url IS NOT NULL
  `.execute(db);

  await sql`
    CREATE FUNCTION face_images_require_rehosted() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.is_active THEN
        PERFORM 1 FROM image_files
          WHERE id = NEW.image_file_id AND rehosted_url IS NOT NULL
          FOR SHARE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'face image % cannot be active: image file % is not rehosted',
            NEW.id, NEW.image_file_id
            USING ERRCODE = 'check_violation';
        END IF;
      END IF;
      RETURN NEW;
    END
    $$
  `.execute(db);
  await sql`
    CREATE TRIGGER trg_face_images_require_rehosted
      BEFORE INSERT OR UPDATE OF is_active, image_file_id ON face_images
      FOR EACH ROW EXECUTE FUNCTION face_images_require_rehosted()
  `.execute(db);

  await sql`
    CREATE FUNCTION image_files_keep_active_rehosted() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM face_images WHERE image_file_id = NEW.id AND is_active) THEN
        RAISE EXCEPTION 'image file % backs an active face image and must stay rehosted', NEW.id
          USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    END
    $$
  `.execute(db);
  await sql`
    CREATE TRIGGER trg_image_files_keep_active_rehosted
      BEFORE UPDATE OF rehosted_url ON image_files
      FOR EACH ROW
      WHEN (OLD.rehosted_url IS NOT NULL AND NEW.rehosted_url IS NULL)
      EXECUTE FUNCTION image_files_keep_active_rehosted()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TRIGGER trg_image_files_keep_active_rehosted ON image_files`.execute(db);
  await sql`DROP FUNCTION image_files_keep_active_rehosted()`.execute(db);
  await sql`DROP TRIGGER trg_face_images_require_rehosted ON face_images`.execute(db);
  await sql`DROP FUNCTION face_images_require_rehosted()`.execute(db);
  await sql`DROP VIEW public_image_files`.execute(db);
  await sql`DROP TABLE image_rehost_failures`.execute(db);
  await sql`DROP INDEX idx_face_images_pending`.execute(db);
  await sql`
    ALTER TABLE face_images
      DROP CONSTRAINT chk_face_images_pending_inactive,
      DROP COLUMN activate_when_rehosted
  `.execute(db);
  await sql`
    ALTER TABLE image_files
      DROP CONSTRAINT chk_image_files_rehosted_url,
      ADD CONSTRAINT chk_image_files_rehosted_url CHECK (rehosted_url <> '')
  `.execute(db);
}
