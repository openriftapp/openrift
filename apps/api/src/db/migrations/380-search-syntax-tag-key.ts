import type { Kysely } from "kysely";
import { sql } from "kysely";

const OTAG = String.raw`(^|\s)otag:`;

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE lists
    SET rules = (
      SELECT jsonb_agg(
        CASE
          WHEN r->'filter'->>'search' IS NULL THEN r
          ELSE jsonb_set(
            r,
            '{filter,search}',
            to_jsonb(regexp_replace(r->'filter'->>'search', ${OTAG}, ${String.raw`\1tag:`}, 'g'))
          )
        END
        ORDER BY position
      )
      FROM jsonb_array_elements(rules) WITH ORDINALITY AS t(r, position)
    )
    WHERE jsonb_array_length(rules) > 0
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(rules) AS e(r)
        WHERE r->'filter'->>'search' ~ ${OTAG}
      )
  `.execute(db);
}

/** The rename is one-way: a stored `tag:` cannot be told apart from one a user typed. */
export { down } from "./_noop.js";
