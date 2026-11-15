import type { MetaScopeFacet } from "@openrift/shared/meta-query";
import type { RawBuilder, SqlBool } from "kysely";
import { sql } from "kysely";

/**
 * The synthetic account that owns every archived deck. It has no `accounts`
 * row, so no credential or OAuth path can produce a session for it — the id is
 * safe to hardcode as the write path's owner.
 */
export const META_ARCHIVE_USER_ID = "meta-archive";

export const TODAY = sql<string>`(now() at time zone 'UTC')::date`;

export const HAS_STANDINGS = sql<SqlBool>`exists (
  select 1 from meta_event_players p where p.meta_event_id = me.id
)`;

export const HAS_DECKS = sql<SqlBool>`exists (
  select 1 from meta_event_players p where p.meta_event_id = me.id and p.deck_id is not null
)`;

export const HAS_LIST = sql<SqlBool>`p.deck_id is not null`;

/** `UPCOMING`, `PLAYED` and `RUNNING` mirror `metaEventStatus` (`@openrift/shared/meta-results`). */
export const UPCOMING = sql<SqlBool>`(me.event_date > ${TODAY} + 1
  or (me.event_date > ${TODAY} and me.status = 'complete' and not ${HAS_STANDINGS}))`;

export const PLAYED = sql<SqlBool>`(me.status = 'complete'
  or (me.status = 'upcoming' and me.event_date < ${TODAY} - 1))`;

export const RUNNING = sql<SqlBool>`(not ${UPCOMING} and not ${PLAYED})`;

export function citedBy(provider: string): RawBuilder<SqlBool> {
  return sql<SqlBool>`exists (
    select 1 from meta_event_sources src
     where src.meta_event_id = me.id and src.provider = ${provider}
  )`;
}

export const NO_PROVIDER_CITATION = sql<SqlBool>`not exists (
  select 1 from meta_event_sources src
   where src.meta_event_id = me.id and src.provider is not null
)`;

/** Requires `cards` joined as `lc` and `mv_card_aggregates` as `lmca`. */
export const ARCHIVE_LEGEND_COLUMNS = [
  "lc.id as cardId",
  "lc.name",
  "lc.slug",
  "lmca.types",
  "lc.tags",
  "lmca.domains",
] as const;

export const ARCHIVE_LEGEND_GROUP = [
  "lc.id",
  "lc.name",
  "lc.slug",
  "lmca.types",
  "lc.tags",
  "lmca.domains",
] as const;

/** Requires `cards` joined as `lc` and `mv_card_aggregates` as `lmca`. */
export const LEGEND_REF_COLUMNS = [
  "lc.name as legendName",
  "lc.slug as legendSlug",
  "lmca.types as legendTypes",
  "lc.tags as legendTags",
  "lmca.domains as legendDomains",
] as const;

export function dueBefore(now: Date): Date {
  return new Date(now.getTime() + 1);
}

/**
 * Inclusive date-only bounds on the event a deck was played at. Either end may
 * be open; both absent is the whole archive.
 */
interface MetaDeckDateRange {
  from?: string;
  to?: string;
}

/**
 * The archive scope bar's selection as a read applies it, over the event's own
 * fields. Each facet is an include list or an exclude list, never both.
 */
export interface MetaScopeFilters extends MetaDeckDateRange {
  formats?: readonly string[];
  formatsEx?: readonly string[];
  tiers?: readonly string[];
  tiersEx?: readonly string[];
  /** ISO 3166-1 alpha-2, matched case-insensitively against the stored code. */
  countries?: readonly string[];
  countriesEx?: readonly string[];
}

/**
 * The player's name as every read serves it: the row's own column when the
 * archive holds one, otherwise the source's current display name. Writing the
 * local column is the admin's override, and clearing it hands the player back to
 * the source's renames.
 *
 * Requires `uvsgames_players` left-joined as `up`.
 */
export const resolvedPlayerName = sql<string>`coalesce(p.player_name, up.display_name)`;

/**
 * Must stay character-for-character what `metaPlayerKey` and
 * `idx_meta_event_players_player_key` compute.
 */
export const foldedPlayerIdentity = sql<string>`regexp_replace(p.source_identity, '#\\d+$', '')`;

/**
 * One facet as SQL over a column of the event alias `me`. An include list keeps
 * only its values; an exclude list drops them and keeps a row whose column is
 * null, since "all but Germany" is a claim about Germany and not about the
 * events no source named a venue for. A facet carries at most one of the two.
 */
function facetCondition(
  column: RawBuilder<unknown>,
  included?: readonly string[],
  excluded?: readonly string[],
): RawBuilder<SqlBool> | undefined {
  if (included !== undefined && included.length > 0) {
    return sql<SqlBool>`${column} in (${sql.join(included.map((value) => sql`${value}`))})`;
  }
  if (excluded !== undefined && excluded.length > 0) {
    const values = sql.join(excluded.map((value) => sql`${value}`));
    return sql<SqlBool>`(${column} is null or ${column} not in (${values}))`;
  }
  return undefined;
}

/** Every condition a scope puts on the event alias `me`. A lifted facet is left unapplied. */
export function scopeConditions(
  scope: MetaScopeFilters,
  lifted?: MetaScopeFacet,
): RawBuilder<SqlBool>[] {
  const upper = (values?: readonly string[]) => values?.map((value) => value.toUpperCase());
  const facet = (name: MetaScopeFacet, condition: () => RawBuilder<SqlBool> | undefined) =>
    lifted === name ? undefined : condition();
  return [
    scope.from === undefined ? undefined : sql<SqlBool>`me.event_date >= ${scope.from}`,
    scope.to === undefined ? undefined : sql<SqlBool>`me.event_date <= ${scope.to}`,
    facet("formats", () => facetCondition(sql`me.format`, scope.formats, scope.formatsEx)),
    facet("tiers", () => facetCondition(sql`me.tier`, scope.tiers, scope.tiersEx)),
    facet("countries", () =>
      facetCondition(sql`me.country`, upper(scope.countries), upper(scope.countriesEx)),
    ),
  ].filter((condition) => condition !== undefined);
}
