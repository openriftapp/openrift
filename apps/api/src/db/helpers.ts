import type { CardType } from "@openrift/shared/types/enums";
import type { SqlBool } from "kysely";
import { sql } from "kysely";

export function primaryCardType(cardIdColumn: string) {
  return sql<CardType>`(SELECT cct.type_slug FROM card_card_types cct WHERE cct.card_id = ${sql.ref(cardIdColumn)} ORDER BY cct.position LIMIT 1)`;
}

export function cardTypes(cardIdColumn: string) {
  return sql<
    CardType[]
  >`(SELECT array_agg(cct.type_slug ORDER BY cct.position) FROM card_card_types cct WHERE cct.card_id = ${sql.ref(cardIdColumn)})`;
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
