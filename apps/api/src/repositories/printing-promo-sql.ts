import { sql } from "kysely";

/** A printing with a marker on either face or a distribution channel, over the alias `p`. */
export const printingIsPromo = sql<boolean>`(
  exists (
    select 1 from faces mf
    where mf.id in (p.face1_id, p.face2_id) and cardinality(mf.marker_slugs) > 0
  )
  or exists (select 1 from printing_distribution_channels pdc2 where pdc2.printing_id = p.id)
)`;

/** A printing the actor created, over the alias `p`. */
export function printingCreatedBy(actorUserId: string) {
  return sql<boolean>`p.id::text in (
    select ce.entity_id from admin_events ce
    where ce.actor_user_id = ${actorUserId} and ce.action = 'printing.create'
      and ce.entity_type = 'printing'
  )`;
}

export function printingInDeskScope(actorUserId: string) {
  return sql<boolean>`(${printingIsPromo} or ${printingCreatedBy(actorUserId)})`;
}
