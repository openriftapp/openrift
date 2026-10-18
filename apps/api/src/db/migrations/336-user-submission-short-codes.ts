import type { Kysely } from "kysely";
import { sql } from "kysely";

// User-submitted printings kept any suffix after the card number in their short
// code (SGN-T07-P-SC). Recompute it as set-number, as shortCodeFromPublicCode does.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE candidate_printings cp
    SET short_code = derived.short_code
    FROM (
      SELECT cp2.id,
        CASE
          WHEN split_part(split_part(cp2.public_code, '/', 1), '-', 2) = ''
            THEN split_part(split_part(cp2.public_code, '/', 1), '-', 1)
          ELSE split_part(split_part(cp2.public_code, '/', 1), '-', 1)
            || '-' || split_part(split_part(cp2.public_code, '/', 1), '-', 2)
        END AS short_code
      FROM candidate_printings cp2
      JOIN candidate_cards cc ON cc.id = cp2.candidate_card_id
      WHERE cc.provider = 'usersubmission' AND cp2.public_code IS NOT NULL
    ) derived
    WHERE cp.id = derived.id
      AND derived.short_code <> ''
      AND cp.short_code IS DISTINCT FROM derived.short_code
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE candidate_printings cp
    SET short_code = split_part(cp.public_code, '/', 1)
    FROM candidate_cards cc
    WHERE cc.id = cp.candidate_card_id
      AND cc.provider = 'usersubmission'
      AND cp.public_code IS NOT NULL
      AND split_part(cp.public_code, '/', 1) <> ''
  `.execute(db);
}
