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
}

const undecided = sql<SqlBool>`i.provider is null and src.meta_event_id is null`;
const published = sql<SqlBool>`i.provider is null and src.meta_event_id is not null`;
const rejected = sql<SqlBool>`i.provider is not null`;

export const JOINED_TRIAGE: MirrorTriagePredicates = { undecided, published, rejected };

export const NEVER = sql<SqlBool>`false`;

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
  return {
    undecided: sql<SqlBool>`${notDismissed} and ${notLinked}`,
    published: sql<SqlBool>`${notDismissed} and src.meta_event_id is not null`,
    rejected,
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
  const { undecided: isUndecided, published: isPublished } = triage;
  const passes = columns.passes(rule);
  const scheduled = sql<SqlBool>`${nextCheckAt} is not null`;
  switch (bucket) {
    case "needsDecision": {
      return sql<SqlBool>`((${isUndecided}) and (${started}) and (${passes}) and (${hasResults}))`;
    }
    case "passingNoResults": {
      return sql<SqlBool>`((${isUndecided}) and (${started}) and (${passes}) and not (${hasResults}))`;
    }
    case "skippedUpcoming": {
      return sql<SqlBool>`((${isUndecided}) and not (${started}))`;
    }
    case "skippedPast": {
      return sql<SqlBool>`((${isUndecided}) and (${started}) and not (${passes}))`;
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
