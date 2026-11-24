import type { CardType } from "@openrift/shared/types/enums";
import type { SqlBool } from "kysely";
import { sql } from "kysely";

export function primaryCardTypeSql(cardIdColumn: string) {
  return sql<CardType>`(SELECT cct.type_slug FROM card_card_types cct WHERE cct.card_id = ${sql.ref(cardIdColumn)} ORDER BY cct.sort_order LIMIT 1)`;
}

/** A source row whose printings are all in another language than English. */
export function foreignLanguageCandidate(alias: string) {
  const id = sql.ref(`${alias}.id`);
  return sql<SqlBool>`(
    exists (select 1 from candidate_printings fcp where fcp.candidate_card_id = ${id})
    and not exists (
      select 1 from candidate_printings fcp
      where fcp.candidate_card_id = ${id} and fcp.language = 'EN'
    )
  )`;
}

/** A foreign-language row yields no tags while one of its labels has no translation. */
export function translatedCandidateTags(alias: string) {
  const tags = sql.ref(`${alias}.tags`);
  return sql<string[]>`(case
    when not ${foreignLanguageCandidate(alias)} then ${tags}
    when exists (
      select 1 from unnest(${tags}) raw(label)
      where not exists (select 1 from tag_translations tt where tt.label = raw.label)
    ) then '{}'::text[]
    else array(
      select (select min(tt.tag) from tag_translations tt where tt.label = raw.label)
      from unnest(${tags}) with ordinality raw(label, ord)
      order by raw.ord
    )
  end)`;
}

export function cardTypes(cardIdColumn: string) {
  return sql<
    CardType[]
  >`(SELECT array_agg(cct.type_slug ORDER BY cct.sort_order) FROM card_card_types cct WHERE cct.card_id = ${sql.ref(cardIdColumn)})`;
}

export function cardHasType(cardIdColumn: string, type: CardType) {
  return sql<SqlBool>`EXISTS (SELECT 1 FROM card_card_types cct WHERE cct.card_id = ${sql.ref(cardIdColumn)} AND cct.type_slug = ${type})`;
}

/**
 * Uses raw sql because Kysely's 'is distinct from' operator only supports
 * static column refs; here the columns come from a runtime array.
 */
export function buildDistinctWhere(table: string, columns: readonly string[]) {
  return sql.raw<SqlBool>(
    columns.map((c) => `excluded.${c} IS DISTINCT FROM ${table}.${c}`).join("\n              OR "),
  );
}

/**
 * postgres.js serializes a jsonb param from the raw value; JSON.stringify-ing
 * it first double-encodes into a jsonb string scalar. Never add one back.
 */
