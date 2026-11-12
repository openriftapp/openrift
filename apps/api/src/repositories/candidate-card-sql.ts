import type { RawBuilder, SqlBool } from "kysely";
import { sql } from "kysely";

/**
 * `card_name_aliases` holds every card's own name too, but nothing enforces it
 * and an alias upsert can move a name to another card, so `cards.norm_name` wins.
 */
export function liveCardForNorm(norm: RawBuilder<unknown>): RawBuilder<{
  id: string;
  slug: string;
  name: string;
}> {
  return sql`
    select c.id, c.slug, c.name from cards c
    where ${norm} <> ''
      and (
        c.norm_name = ${norm}
        or c.id in (select a.card_id from card_name_aliases a where a.norm_name = ${norm})
      )
    order by c.norm_name = ${norm} desc
    limit 1
  `;
}

export function isNewCardName(norm: RawBuilder<unknown>): RawBuilder<SqlBool> {
  return sql<SqlBool>`(${norm} <> '' and not exists (${liveCardForNorm(norm)}))`;
}

export function candidateSideOrder(
  side: {
    cardId: RawBuilder<unknown>;
    shortCode: RawBuilder<unknown>;
    isFirst: RawBuilder<unknown>;
  },
  candidate: { normName: RawBuilder<unknown>; shortCode: RawBuilder<unknown> },
): RawBuilder<unknown> {
  return sql`
    ${side.cardId} is not distinct from (select live_card.id from (${liveCardForNorm(candidate.normName)}) live_card) desc,
    upper(${side.shortCode}) = upper(${candidate.shortCode}) desc,
    ${side.isFirst} desc
  `;
}
