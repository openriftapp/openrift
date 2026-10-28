import type { Kysely } from "kysely";
import { sql } from "kysely";

// `t:` must become `otag:` before `ty:` becomes `t:`.
const RENAMES: readonly [string, string][] = [
  ["d", "o"],
  ["t", "otag"],
  ["f", "ft"],
  ["id", "cn"],
  ["ty", "t"],
  ["k", "kw"],
  ["n", ""],
];

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`UPDATE card_types SET is_well_known = true WHERE slug = 'other'`.execute(db);

  let translated = sql`r->'filter'->>'search'`;
  for (const [from, to] of RENAMES) {
    const replacement = to === "" ? String.raw`\1` : String.raw`\1${to}:`;
    translated = sql`regexp_replace(${translated}, ${`(^|\\s)${from}:`}, ${replacement}, 'g')`;
  }
  await sql`
    UPDATE lists
    SET rules = (
      SELECT jsonb_agg(
        CASE
          WHEN r->'filter'->>'search' IS NULL THEN r
          ELSE jsonb_set(r, '{filter,search}', to_jsonb(${translated}))
        END
        ORDER BY position
      )
      FROM jsonb_array_elements(rules) WITH ORDINALITY AS t(r, position)
    )
    WHERE jsonb_array_length(rules) > 0
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(rules) AS e(r)
        WHERE r->'filter'->>'search' ~ '(^|\\s)(id|ty|[dtfkn]):'
      )
  `.execute(db);
}

// The prefix rewrite is one-way, and the protect trigger refuses to unmark `other`;
// leaving it well-known only stops it being renamed or deleted.
// oxlint-disable-next-line eslint/no-empty-function -- nothing can be restored
export async function down(): Promise<void> {}
