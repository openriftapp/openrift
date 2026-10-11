import type { Kysely } from "kysely";
import { sql } from "kysely";

// Every rules version holds its full rule set. Rules a version did not change
// are carried forward from the latest earlier row, and removal tombstones go away.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    INSERT INTO rules (kind, language, version, rule_number, sort_order, depth, rule_type, content, change_type)
    SELECT v.kind, v.language, v.version, r.rule_number, r.sort_order, r.depth, r.rule_type, r.content, 'unchanged'
    FROM rule_versions v
    CROSS JOIN LATERAL (
      SELECT DISTINCT ON (p.rule_number) p.*
      FROM rules p
      WHERE p.kind = v.kind AND p.language = v.language AND p.version <= v.version
      ORDER BY p.rule_number, p.version DESC
    ) r
    WHERE r.change_type <> 'removed' AND r.version < v.version
  `.execute(db);

  await sql`DELETE FROM rules WHERE change_type = 'removed'`.execute(db);

  await sql`
    UPDATE rules SET sort_order = ordered.position - 1
    FROM (
      SELECT id, row_number() OVER (
        PARTITION BY kind, language, version
        ORDER BY ARRAY(
          SELECT CASE WHEN part ~ '^[0-9]+$' THEN lpad(part, 10, '0') ELSE part END COLLATE "C"
          FROM unnest(string_to_array(rule_number, '.')) WITH ORDINALITY AS parts(part, position)
          ORDER BY position
        )
      ) AS position
      FROM rules
    ) ordered
    WHERE rules.id = ordered.id
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    INSERT INTO rules (kind, language, version, rule_number, sort_order, depth, rule_type, content, change_type)
    SELECT v.kind, v.language, v.version, p.rule_number, 1000000 + p.sort_order, 0, 'text', '', 'removed'
    FROM rule_versions v
    CROSS JOIN LATERAL (
      SELECT max(e.version) AS version FROM rule_versions e
      WHERE e.kind = v.kind AND e.language = v.language AND e.version < v.version
    ) prev
    JOIN rules p ON p.kind = v.kind AND p.language = v.language AND p.version = prev.version
    WHERE NOT EXISTS (
      SELECT 1 FROM rules c
      WHERE c.kind = v.kind AND c.language = v.language AND c.version = v.version
        AND c.rule_number = p.rule_number
    )
  `.execute(db);

  await sql`
    DELETE FROM rules r
    WHERE r.change_type = 'unchanged'
      AND EXISTS (
        SELECT 1 FROM rule_versions e
        WHERE e.kind = r.kind AND e.language = r.language AND e.version < r.version
      )
  `.execute(db);
}
