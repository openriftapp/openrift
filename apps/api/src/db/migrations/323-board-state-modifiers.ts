import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE keywords
      ADD COLUMN card_modifier boolean NOT NULL DEFAULT false
  `.execute(db);

  await sql`
    UPDATE keywords
    SET card_modifier = true
    WHERE name IN ('Stun', 'Temporary', 'Hidden', 'Shield', 'Empowered', 'Ganking', 'Deflect')
  `.execute(db);

  await sql`
    UPDATE board_states
    SET document = jsonb_set(
      jsonb_set(
        jsonb_set(document, '{schemaVersion}', '2'::jsonb),
        '{zones,deck}',
        'false'::jsonb,
        true
      ),
      '{steps}',
      (
        SELECT coalesce(jsonb_agg(
          jsonb_set(step, '{pieces}', (
            SELECT coalesce(jsonb_agg(
              (piece - 'stunned' - 'buff') || jsonb_build_object(
                'keywords',
                CASE WHEN piece->>'stunned' = 'true' THEN '["Stun"]'::jsonb ELSE '[]'::jsonb END,
                'might',
                CASE
                  WHEN jsonb_typeof(piece->'buff') = 'number' THEN piece->'buff'
                  ELSE '0'::jsonb
                END
              )
              ORDER BY piece_ord
            ), '[]'::jsonb)
            FROM jsonb_array_elements(step->'pieces') WITH ORDINALITY AS p(piece, piece_ord)
          ))
          ORDER BY step_ord
        ), '[]'::jsonb)
        FROM jsonb_array_elements(document->'steps') WITH ORDINALITY AS s(step, step_ord)
      )
    )
    WHERE document->>'schemaVersion' = '1'
  `.execute(db);
}

// Reverses the keyword column only. Downgrading documents back to v1 is not
// implemented; a rollback needs the v2 reader to stay deployed.
export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE keywords DROP COLUMN IF EXISTS card_modifier
  `.execute(db);
}
