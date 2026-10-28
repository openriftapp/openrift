import { META_NOTABLE_EVENT_NAMES } from "@openrift/shared/contracts/admin/meta-catalog";
import type { RawBuilder, SqlBool } from "kysely";
import { sql } from "kysely";

import { UVSGAMES_STATUS_CANCELED } from "../../../lib/meta-providers.js";
import type { MetaAutoPublishRule } from "./meta-sync-buckets.js";
import { sizeRulePasses } from "./meta-sync-buckets.js";

// Mirrors `mapSourceFormat`; the uncorrelated `any` hashes the mappings once per query.
const formatMapped = sql<SqlBool>`regexp_replace(lower(c.event_format), '[^a-z0-9]+', '', 'g')
  = any (select regexp_replace(lower(fm.source_format), '[^a-z0-9]+', '', 'g')
           from uvsgames_format_mappings fm)`;

/** `autoAcceptRule` as SQL over the mirror row `c`, so the buckets count what the job publishes. */
export function uvsgamesRulePasses(rule: MetaAutoPublishRule): RawBuilder<SqlBool> {
  const official = rule.autoAcceptOfficial
    ? sql<SqlBool>`c.event_configuration_template = any (
        select t.template_id from uvsgames_event_templates t where t.watched
      )`
    : sql<SqlBool>`false`;
  const notable = rule.autoAcceptNotable
    ? sql<SqlBool>`lower(c.name) like any (${META_NOTABLE_EVENT_NAMES.map((name) => `%${name}%`)}::text[])`
    : sql<SqlBool>`false`;
  const size = sizeRulePasses(sql`c.player_count`, sql<SqlBool>`false`, rule.autoAcceptMinPlayers);
  // A null format or template would leave the test null, which `not` cannot negate.
  return sql<SqlBool>`coalesce(${formatMapped} and c.display_status <> ${UVSGAMES_STATUS_CANCELED}
    and (coalesce(${official}, false) or ${size} or ${notable}), false)`;
}
