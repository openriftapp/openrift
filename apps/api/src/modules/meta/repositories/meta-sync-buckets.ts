import type { RawBuilder, SqlBool } from "kysely";
import { sql } from "kysely";

/** Each source's own column expressions, over its triaged query (`src`, `i` joined). */
export interface MetaSyncBucketColumns {
  started: RawBuilder<SqlBool>;
  startAt: RawBuilder<Date | null>;
  hasResults: RawBuilder<SqlBool>;
  nextCheckAt: RawBuilder<Date | null>;
  players: RawBuilder<number | null>;
  team: RawBuilder<SqlBool>;
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

const undecided = sql<SqlBool>`i.provider is null and src.meta_event_id is null`;

/** A `null` threshold means auto-publish is off, so no undecided event passes the rule. */
function passesRule(columns: MetaSyncBucketColumns, minPlayers: number | null) {
  return minPlayers === null
    ? sql<SqlBool>`false`
    : sql<SqlBool>`coalesce(${columns.players} >= ${minPlayers}, false) and not (${columns.team})`;
}

export function passingNoResultsFilter(columns: MetaSyncBucketColumns, minPlayers: number) {
  return metaSyncBucketFilter("passingNoResults", columns, minPlayers);
}

export function metaSyncBucketFilter(
  bucket: "needsDecision" | "passingNoResults",
  columns: MetaSyncBucketColumns,
  minPlayers: number,
) {
  const results =
    bucket === "needsDecision"
      ? sql<SqlBool>`(${columns.hasResults})`
      : sql<SqlBool>`not (${columns.hasResults})`;
  return sql<SqlBool>`(${undecided}) and (${columns.started}) and (${passesRule(columns, minPlayers)}) and ${results}`;
}

export function metaSyncBucketSelections(
  columns: MetaSyncBucketColumns,
  minPlayers: number | null,
) {
  const { started, startAt, hasResults, nextCheckAt } = columns;
  const published = sql<SqlBool>`i.provider is null and src.meta_event_id is not null`;
  const passes = passesRule(columns, minPlayers);
  const scheduled = sql<SqlBool>`${nextCheckAt} is not null`;
  return [
    sql<string>`count(*) filter (where (${published}) and not (${started}))`.as("notStarted"),
    sql<Date | null>`min(${startAt}) filter (where (${published}) and not (${started}))`.as(
      "firstStartAt",
    ),
    sql<string>`count(*) filter (where (${published}) and (${started}) and (${scheduled}))`.as(
      "collecting",
    ),
    sql<Date | null>`min(${nextCheckAt}) filter (where ${nextCheckAt} > now())`.as("nextCheckAt"),
    sql<string>`count(*) filter (where (${published}) and (${started}) and not (${scheduled}) and (${hasResults}))`.as(
      "final",
    ),
    sql<string>`count(*) filter (where (${published}) and (${started}) and not (${scheduled}) and not (${hasResults}))`.as(
      "noResults",
    ),
    sql<string>`count(*) filter (where (${undecided}) and (${started}) and (${passes}) and (${hasResults}))`.as(
      "needsDecision",
    ),
    sql<string>`count(*) filter (where (${undecided}) and (${started}) and (${passes}) and not (${hasResults}))`.as(
      "passingNoResults",
    ),
    sql<string>`count(*) filter (where (${undecided}) and not (${started}))`.as("skippedUpcoming"),
    sql<string>`count(*) filter (where (${undecided}) and (${started}) and not (${passes}))`.as(
      "skippedPast",
    ),
  ] as const;
}

export function toMetaSyncBuckets(row: {
  notStarted: string;
  firstStartAt: Date | null;
  collecting: string;
  nextCheckAt: Date | null;
  final: string;
  noResults: string;
  needsDecision: string;
  passingNoResults: string;
  skippedUpcoming: string;
  skippedPast: string;
}): MetaSyncBuckets {
  return {
    notStarted: Number(row.notStarted),
    firstStartAt: row.firstStartAt,
    collecting: Number(row.collecting),
    nextCheckAt: row.nextCheckAt,
    final: Number(row.final),
    noResults: Number(row.noResults),
    needsDecision: Number(row.needsDecision),
    passingNoResults: Number(row.passingNoResults),
    skippedUpcoming: Number(row.skippedUpcoming),
    skippedPast: Number(row.skippedPast),
  };
}
