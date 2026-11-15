import type { MetaSyncBucketFilter } from "@openrift/shared/contracts/admin/meta-catalog";
import type { RawBuilder, SqlBool } from "kysely";
import { sql } from "kysely";

/** Each source's own column expressions, over its triaged query (`src`, `i` joined). */
export interface MetaSyncBucketColumns {
  started: RawBuilder<SqlBool>;
  startAt: RawBuilder<Date | null>;
  hasResults: RawBuilder<SqlBool>;
  nextCheckAt: RawBuilder<Date | null>;
  passes: (rule: MetaAutoPublishRule) => RawBuilder<SqlBool>;
  held: RawBuilder<SqlBool>;
}

export interface MetaAutoPublishRule {
  autoAcceptMinPlayers: number | null;
  autoAcceptOfficial: boolean;
  autoAcceptNotable: boolean;
}

interface MetaSyncBuckets {
  notStarted: number;
  firstStartAt: Date | null;
  collecting: number;
  nextCheckAt: Date | null;
  final: number;
  noResults: number;
  needsDecision: number;
  passingNoResults: number;
  skippedUpcoming: number;
  skippedPast: number;
  held: number;
}

export type MetaSyncBucketCounts = Omit<MetaSyncBuckets, "firstStartAt" | "nextCheckAt"> & {
  undecided: number;
  published: number;
  rejected: number;
  total: number;
};

export type MirrorTriage = "new" | "accepted" | "dismissed";

export interface MirrorTriageCounts {
  new: number;
  accepted: number;
  dismissed: number;
}

export interface MirrorListOrder {
  sort?: "startAt" | "name" | "playerCount";
  direction?: "asc" | "desc";
}

export interface MirrorSyncOverview extends MetaSyncBuckets {
  total: number;
  completed: number;
  decklistPublished: number;
  missing: number;
  dueRecheck: number;
  oldestDueAt: Date | null;
  queued: number;
  acceptedAwaitingResults: number;
  acceptedMissing: number;
  acceptedCancelled: number;
  lastSeenAt: Date | null;
}

interface MirrorOverviewColumns {
  completed: RawBuilder<SqlBool>;
  decklistPublished: RawBuilder<SqlBool>;
  awaitingResults: RawBuilder<SqlBool>;
  cancelled: RawBuilder<SqlBool>;
}

interface MirrorTriagePredicates {
  undecided: RawBuilder<SqlBool>;
  published: RawBuilder<SqlBool>;
  rejected: RawBuilder<SqlBool>;
  held?: RawBuilder<SqlBool>;
  notHeld?: RawBuilder<SqlBool>;
}

const undecided = sql<SqlBool>`i.provider is null and src.meta_event_id is null`;
const published = sql<SqlBool>`i.provider is null and src.meta_event_id is not null`;
const rejected = sql<SqlBool>`i.provider is not null`;

export const JOINED_TRIAGE: MirrorTriagePredicates = { undecided, published, rejected };

export const NEVER = sql<SqlBool>`false`;

// Uncorrelated, so the planner hashes the hold list once instead of probing it per catalogue row.
export function heldBySameStore(provider: string, key: RawBuilder<string>): RawBuilder<SqlBool> {
  return sql<SqlBool>`${key} in (
    select h.external_id from meta_held_source_events h where h.provider = ${provider}
  )`;
}

export interface MirrorHeldBy {
  metaEventId: string;
  metaEventSlug: string;
  metaEventName: string;
}

/** A hold counts only while the row still passes `rule`; without one no row reads as held. */
export function heldBySelection(
  provider: string,
  key: RawBuilder<string>,
  columns: MetaSyncBucketColumns,
  rule?: MetaAutoPublishRule,
) {
  const passes = rule === undefined ? NEVER : columns.passes(rule);
  return sql<MirrorHeldBy | null>`(
    select json_build_object('metaEventId', hme.id, 'metaEventSlug', hme.slug, 'metaEventName', hme.name)
      from meta_held_source_events h
      join meta_events hme on hme.id = h.meta_event_id
     where h.provider = ${provider} and h.external_id = ${key} and ${undecided} and (${passes})
  )`.as("heldBy");
}

export const TRIAGE_STATE = sql<MirrorTriage>`case
    when i.provider is not null then 'dismissed'
    when src.meta_event_id is not null then 'accepted'
    else 'new'
  end`;

// Absence must be an anti-join here: reading a joined null makes the planner
// sort the whole catalogue before taking one page. Presence reads the join.
export function pagedTriage(provider: string, key: RawBuilder<string>): MirrorTriagePredicates {
  const notDismissed = sql<SqlBool>`not exists (
    select 1 from ignored_meta_source_events x
     where x.provider = ${provider} and x.external_id = ${key}
  )`;
  const notLinked = sql<SqlBool>`not exists (
    select 1 from meta_event_sources y
     where y.provider = ${provider} and y.external_id = ${key}
       and y.meta_event_id is not null
  )`;
  const hold = sql<SqlBool>`exists (
    select 1 from meta_held_source_events h
     where h.provider = ${provider} and h.external_id = ${key}
  )`;
  return {
    undecided: sql<SqlBool>`${notDismissed} and ${notLinked}`,
    published: sql<SqlBool>`${notDismissed} and src.meta_event_id is not null`,
    rejected,
    held: hold,
    notHeld: sql<SqlBool>`not ${hold}`,
  };
}

const TRIAGE_PREDICATE = {
  new: "undecided",
  accepted: "published",
  dismissed: "rejected",
} as const satisfies Record<MirrorTriage, keyof MirrorTriagePredicates>;

export function mirrorListConditions(
  narrowed: readonly RawBuilder<SqlBool>[],
  filters: {
    triage?: MirrorTriage;
    bucket?: { name: MetaSyncBucketFilter; rule: MetaAutoPublishRule };
  },
  columns: MetaSyncBucketColumns,
  paged: MirrorTriagePredicates,
): RawBuilder<SqlBool>[] {
  const conditions = [...narrowed];
  if (filters.bucket !== undefined) {
    conditions.push(
      metaSyncBucketCondition(filters.bucket.name, columns, filters.bucket.rule, paged),
    );
  }
  if (filters.triage !== undefined) {
    conditions.push(paged[TRIAGE_PREDICATE[filters.triage]]);
  }
  return conditions;
}

export function mirrorFieldConditions(filters: {
  minPlayers?: number;
  dateFrom?: Date | string;
  dateTo?: Date | string;
  missing?: boolean;
}): RawBuilder<SqlBool>[] {
  const conditions: RawBuilder<SqlBool>[] = [];
  if (filters.minPlayers !== undefined) {
    conditions.push(sql<SqlBool>`c.player_count >= ${filters.minPlayers}`);
  }
  if (filters.dateFrom !== undefined) {
    conditions.push(sql<SqlBool>`c.start_at >= ${filters.dateFrom}`);
  }
  if (filters.dateTo !== undefined) {
    conditions.push(sql<SqlBool>`c.start_at <= ${filters.dateTo}`);
  }
  if (filters.missing === true) {
    conditions.push(sql<SqlBool>`c.missing_since is not null`);
  }
  return conditions;
}

export function catalogOrderBy(playerCount: RawBuilder<unknown>, order: MirrorListOrder) {
  const columns = { startAt: sql`c.start_at`, name: sql`lower(c.name)`, playerCount };
  const column = columns[order.sort ?? "startAt"];
  return order.direction === "asc" ? sql`${column} asc nulls last` : sql`${column} desc nulls last`;
}

export function triageCountSelections() {
  return [
    sql<number>`count(*) filter (where ${undecided})::int`.as("new"),
    sql<number>`count(*) filter (where ${published})::int`.as("accepted"),
    sql<number>`count(*) filter (where ${rejected})::int`.as("dismissed"),
  ] as const;
}

/** The player-count half every source shares; a `null` threshold passes nothing. */
export function sizeRulePasses(
  players: RawBuilder<number | null>,
  team: RawBuilder<SqlBool>,
  minPlayers: number | null,
): RawBuilder<SqlBool> {
  return minPlayers === null
    ? sql<SqlBool>`false`
    : sql<SqlBool>`(coalesce(${players} >= ${minPlayers}, false) and not (${team}))`;
}

interface MetaSyncBucketTriage {
  undecided: RawBuilder<SqlBool>;
  published: RawBuilder<SqlBool>;
  held?: RawBuilder<SqlBool>;
  notHeld?: RawBuilder<SqlBool>;
}

/**
 * In a `where`, pass the source's anti-join triage: a joined null leaves the
 * planner estimating one row and nesting loops over the whole catalogue.
 */
export function metaSyncBucketCondition(
  bucket: MetaSyncBucketFilter,
  columns: MetaSyncBucketColumns,
  rule: MetaAutoPublishRule,
  triage: MetaSyncBucketTriage = JOINED_TRIAGE,
): RawBuilder<SqlBool> {
  const { started, hasResults, nextCheckAt } = columns;
  const { undecided: unjudged, published: isPublished } = triage;
  const held = triage.held ?? columns.held;
  const notHeld = triage.notHeld ?? sql<SqlBool>`not (${columns.held})`;
  const passes = columns.passes(rule);
  const passingUndecided = sql<SqlBool>`(${unjudged}) and ${notHeld} and (${passes})`;
  const scheduled = sql<SqlBool>`${nextCheckAt} is not null`;
  switch (bucket) {
    case "needsDecision": {
      return sql<SqlBool>`((${passingUndecided}) and (${started}) and (${hasResults}))`;
    }
    case "passingNoResults": {
      return sql<SqlBool>`((${passingUndecided}) and (${started}) and not (${hasResults}))`;
    }
    case "skippedUpcoming": {
      return sql<SqlBool>`((${unjudged}) and not (${started}) and not ((${passes}) and (${columns.held})))`;
    }
    case "skippedPast": {
      return sql<SqlBool>`((${unjudged}) and (${started}) and not (${passes}))`;
    }
    case "held": {
      return sql<SqlBool>`((${unjudged}) and (${held}) and (${passes}))`;
    }
    case "notStarted": {
      return sql<SqlBool>`((${isPublished}) and not (${started}))`;
    }
    case "collecting": {
      return sql<SqlBool>`((${isPublished}) and (${started}) and (${scheduled}))`;
    }
    case "final": {
      return sql<SqlBool>`((${isPublished}) and (${started}) and not (${scheduled}) and (${hasResults}))`;
    }
    case "noResults": {
      return sql<SqlBool>`((${isPublished}) and (${started}) and not (${scheduled}) and not (${hasResults}))`;
    }
  }
}

function countWhere<A extends string>(condition: RawBuilder<SqlBool>, alias: A) {
  return sql<string>`count(*) filter (where ${condition})`.as(alias);
}

export function metaSyncBucketCountSelections(
  columns: MetaSyncBucketColumns,
  rule: MetaAutoPublishRule,
) {
  const bucket = <N extends MetaSyncBucketFilter>(name: N) =>
    countWhere(metaSyncBucketCondition(name, columns, rule), name);
  return [
    bucket("notStarted"),
    bucket("collecting"),
    bucket("final"),
    bucket("noResults"),
    bucket("needsDecision"),
    bucket("passingNoResults"),
    bucket("skippedUpcoming"),
    bucket("skippedPast"),
    bucket("held"),
    countWhere(undecided, "undecided"),
    countWhere(published, "published"),
    countWhere(rejected, "rejected"),
    sql<string>`count(*)`.as("total"),
  ] as const;
}

function metaSyncBucketSelections(columns: MetaSyncBucketColumns, rule: MetaAutoPublishRule) {
  const { started, startAt, nextCheckAt } = columns;
  return [
    ...metaSyncBucketCountSelections(columns, rule),
    sql<Date | null>`min(${startAt}) filter (where (${published}) and not (${started}))`.as(
      "firstStartAt",
    ),
    sql<Date | null>`min(${nextCheckAt}) filter (where ${nextCheckAt} > now())`.as("nextCheckAt"),
  ] as const;
}

type CountRow = Record<
  MetaSyncBucketFilter | "undecided" | "published" | "rejected" | "total",
  string
>;

function toMetaSyncBucketCounts(row: CountRow): MetaSyncBucketCounts {
  return {
    notStarted: Number(row.notStarted),
    collecting: Number(row.collecting),
    final: Number(row.final),
    noResults: Number(row.noResults),
    needsDecision: Number(row.needsDecision),
    passingNoResults: Number(row.passingNoResults),
    skippedUpcoming: Number(row.skippedUpcoming),
    skippedPast: Number(row.skippedPast),
    held: Number(row.held),
    undecided: Number(row.undecided),
    published: Number(row.published),
    rejected: Number(row.rejected),
    total: Number(row.total),
  };
}

/** `null` when no filter narrows the list: the sync status already holds these counts. */
export async function narrowedBucketCounts(
  conditions: readonly RawBuilder<SqlBool>[],
  count: (narrowed: RawBuilder<SqlBool>) => Promise<CountRow>,
): Promise<MetaSyncBucketCounts | null> {
  if (conditions.length === 0) {
    return null;
  }
  return toMetaSyncBucketCounts(await count(sql.join(conditions, sql` and `)));
}

function toMetaSyncBuckets(
  row: CountRow & { firstStartAt: Date | null; nextCheckAt: Date | null },
): MetaSyncBuckets {
  const counts = toMetaSyncBucketCounts(row);
  return {
    notStarted: counts.notStarted,
    firstStartAt: row.firstStartAt,
    collecting: counts.collecting,
    nextCheckAt: row.nextCheckAt,
    final: counts.final,
    noResults: counts.noResults,
    needsDecision: counts.needsDecision,
    passingNoResults: counts.passingNoResults,
    skippedUpcoming: counts.skippedUpcoming,
    skippedPast: counts.skippedPast,
    held: counts.held,
  };
}

export function mirrorOverviewSelections(
  columns: MetaSyncBucketColumns,
  rule: MetaAutoPublishRule,
  overview: MirrorOverviewColumns,
) {
  const { nextCheckAt } = columns;
  return [
    sql<string>`count(*) filter (where ${overview.completed})`.as("completed"),
    sql<string>`count(*) filter (where ${overview.decklistPublished})`.as("decklistPublished"),
    sql<string>`count(*) filter (where c.missing_since is not null)`.as("missing"),
    sql<string>`count(*) filter (where ${nextCheckAt} is not null and ${nextCheckAt} <= now())`.as(
      "dueRecheck",
    ),
    sql<Date | null>`min(${nextCheckAt}) filter (where ${nextCheckAt} <= now())`.as("oldestDueAt"),
    sql<string>`count(*) filter (where ${nextCheckAt} is not null)`.as("queued"),
    sql<string>`count(*) filter (where (${published}) and (${overview.awaitingResults}))`.as(
      "acceptedAwaitingResults",
    ),
    sql<string>`count(*) filter (where (${published}) and c.missing_since is not null)`.as(
      "acceptedMissing",
    ),
    sql<string>`count(*) filter (where (${published}) and (${overview.cancelled}))`.as(
      "acceptedCancelled",
    ),
    sql<Date | null>`max(${sql.ref("c.lastSeenAt")})`.as("lastSeenAt"),
    ...metaSyncBucketSelections(columns, rule),
  ] as const;
}

type OverviewRow = CountRow &
  Record<
    | "completed"
    | "decklistPublished"
    | "missing"
    | "dueRecheck"
    | "queued"
    | "acceptedAwaitingResults"
    | "acceptedMissing"
    | "acceptedCancelled",
    string
  > & {
    firstStartAt: Date | null;
    nextCheckAt: Date | null;
    oldestDueAt: Date | null;
    lastSeenAt: Date | null;
  };

export function toMirrorSyncOverview(row: OverviewRow): MirrorSyncOverview {
  return {
    ...toMetaSyncBuckets(row),
    total: Number(row.total),
    completed: Number(row.completed),
    decklistPublished: Number(row.decklistPublished),
    missing: Number(row.missing),
    dueRecheck: Number(row.dueRecheck),
    oldestDueAt: row.oldestDueAt,
    queued: Number(row.queued),
    acceptedAwaitingResults: Number(row.acceptedAwaitingResults),
    acceptedMissing: Number(row.acceptedMissing),
    acceptedCancelled: Number(row.acceptedCancelled),
    lastSeenAt: row.lastSeenAt,
  };
}
