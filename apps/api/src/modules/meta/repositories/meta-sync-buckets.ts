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

export interface MetaSyncBuckets {
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

const undecided = sql<SqlBool>`i.provider is null and src.meta_event_id is null`;
const published = sql<SqlBool>`i.provider is null and src.meta_event_id is not null`;
const rejected = sql<SqlBool>`i.provider is not null`;

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

export function metaSyncBucketCondition(
  bucket: MetaSyncBucketFilter,
  columns: MetaSyncBucketColumns,
  rule: MetaAutoPublishRule,
): RawBuilder<SqlBool> {
  const { started, hasResults, nextCheckAt } = columns;
  const passes = columns.passes(rule);
  const scheduled = sql<SqlBool>`${nextCheckAt} is not null`;
  switch (bucket) {
    case "needsDecision": {
      return sql<SqlBool>`((${undecided}) and (${started}) and (${passes}) and (${hasResults}))`;
    }
    case "passingNoResults": {
      return sql<SqlBool>`((${undecided}) and (${started}) and (${passes}) and not (${hasResults}))`;
    }
    case "skippedUpcoming": {
      return sql<SqlBool>`((${undecided}) and not (${started}))`;
    }
    case "skippedPast": {
      return sql<SqlBool>`((${undecided}) and (${started}) and not (${passes}))`;
    }
    case "notStarted": {
      return sql<SqlBool>`((${published}) and not (${started}))`;
    }
    case "collecting": {
      return sql<SqlBool>`((${published}) and (${started}) and (${scheduled}))`;
    }
    case "final": {
      return sql<SqlBool>`((${published}) and (${started}) and not (${scheduled}) and (${hasResults}))`;
    }
    case "noResults": {
      return sql<SqlBool>`((${published}) and (${started}) and not (${scheduled}) and not (${hasResults}))`;
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

export function metaSyncBucketSelections(
  columns: MetaSyncBucketColumns,
  rule: MetaAutoPublishRule,
) {
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

export function toMetaSyncBucketCounts(row: CountRow): MetaSyncBucketCounts {
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

export function toMetaSyncBuckets(
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
