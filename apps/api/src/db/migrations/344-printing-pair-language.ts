import type { Kysely } from "kysely";
import { sql } from "kysely";

// Both faces of a printing share one language: `/catalog?langs=` splits printings by side 1's.
const UP = [
  `CREATE FUNCTION check_printing_pair_language() RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM printings p
      JOIN faces f1 ON f1.id = p.face1_id
      JOIN faces f2 ON f2.id = p.face2_id
      WHERE f1.language <> f2.language
        AND (CASE WHEN TG_TABLE_NAME = 'faces'
                  THEN NEW.id IN (p.face1_id, p.face2_id)
                  ELSE p.id = NEW.id END)
    ) THEN
      RAISE EXCEPTION 'both faces of a printing must share one language'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
  END
  $fn$`,
  `CREATE CONSTRAINT TRIGGER trg_printings_pair_language
    AFTER INSERT OR UPDATE OF face1_id, face2_id ON printings
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_printing_pair_language()`,
  `CREATE CONSTRAINT TRIGGER trg_faces_pair_language
    AFTER UPDATE OF language ON faces
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_printing_pair_language()`,
];

const DOWN = [
  `DROP TRIGGER trg_faces_pair_language ON faces`,
  `DROP TRIGGER trg_printings_pair_language ON printings`,
  `DROP FUNCTION check_printing_pair_language()`,
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const statement of UP) {
    await sql.raw(statement).execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const statement of DOWN) {
    await sql.raw(statement).execute(db);
  }
}
