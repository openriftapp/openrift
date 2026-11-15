import { META_SYNC_BUCKET_FILTERS } from "@openrift/shared/meta-sync-buckets";
import type { Kysely } from "kysely";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";

import type { Database } from "../../../db/tables.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import type { MetaAutoPublishRule, MetaSyncBucketColumns } from "./meta-sync-buckets.js";
import {
  heldBySelection,
  metaSyncBucketCondition,
  metaSyncBucketCountSelections,
  mirrorOverviewSelections,
  triageCountSelections,
} from "./meta-sync-buckets.js";
import { playloltcgEventsRepo } from "./playloltcg-events.js";
import { playriftboundEventsRepo } from "./playriftbound-events.js";
import { topdeckEventsRepo } from "./topdeck-events.js";
import { uvsgamesEventsRepo } from "./uvsgames-events.js";

const rule: MetaAutoPublishRule = {
  autoAcceptMinPlayers: 16,
  autoAcceptOfficial: true,
  autoAcceptNotable: true,
};

const columns: MetaSyncBucketColumns = {
  started: sql`c.start_at <= now()`,
  startAt: sql`c.start_at`,
  hasResults: sql`c.done`,
  nextCheckAt: sql`ck.next_check_at`,
  passes: (applied) => (applied.autoAcceptMinPlayers === null ? sql`false` : sql`c.passes`),
  held: sql`c.held`,
};

const RULE_OFF: MetaAutoPublishRule = {
  autoAcceptMinPlayers: null,
  autoAcceptOfficial: false,
  autoAcceptNotable: false,
};

const JOINED_UNDECIDED = "i.provider is null and src.meta_event_id is null";
const JOINED_PUBLISHED = "i.provider is null and src.meta_event_id is not null";

function bucketWhere(statement: string): string {
  const start = statement.indexOf(" where ((");
  expect(start).toBeGreaterThan(-1);
  const end = statement.indexOf(" order by ");
  return statement.slice(start, end === -1 ? undefined : end);
}

function compile(db: Kysely<Database>, condition: ReturnType<typeof metaSyncBucketCondition>) {
  return db
    .selectFrom("uvsgamesEvents as c")
    .select(sql`1`.as("x"))
    .where(condition)
    .compile().sql;
}

describe("metaSyncBucketCondition", () => {
  const { db } = createRecordingDb();

  it("reads the joined triage by default", () => {
    expect(compile(db, metaSyncBucketCondition("skippedPast", columns, rule))).toContain(
      JOINED_UNDECIDED,
    );
    expect(compile(db, metaSyncBucketCondition("final", columns, rule))).toContain(
      JOINED_PUBLISHED,
    );
  });

  it.each(META_SYNC_BUCKET_FILTERS)("builds %s from the triage it is given", (bucket) => {
    const text = compile(
      db,
      metaSyncBucketCondition(bucket, columns, rule, {
        undecided: sql`undecided_test`,
        published: sql`published_test`,
      }),
    );

    expect(text).toMatch(/undecided_test|published_test/u);
    expect(text).not.toContain(JOINED_UNDECIDED);
    expect(text).not.toContain(JOINED_PUBLISHED);
  });

  it.each(["needsDecision", "passingNoResults"] as const)(
    "keeps held rows that pass the rule out of %s",
    (bucket) => {
      expect(compile(db, metaSyncBucketCondition(bucket, columns, rule))).toContain(
        `(${JOINED_UNDECIDED}) and not (c.held) and (c.passes)`,
      );
    },
  );

  it("keeps an upcoming row out of skipped only while its hold and the rule both apply", () => {
    expect(compile(db, metaSyncBucketCondition("skippedUpcoming", columns, rule))).toContain(
      "not ((c.passes) and (c.held))",
    );
  });

  it("puts undecided held rows that pass the rule in the held bucket", () => {
    expect(compile(db, metaSyncBucketCondition("held", columns, rule))).toBe(
      compile(db, sql`((${sql.raw(JOINED_UNDECIDED)}) and (c.held) and (c.passes))`),
    );
  });

  it("treats a hold recorded under a rule that no longer applies as skipped", () => {
    expect(compile(db, metaSyncBucketCondition("held", columns, RULE_OFF))).toContain(
      "(c.held) and (false)",
    );
    expect(compile(db, metaSyncBucketCondition("skippedPast", columns, RULE_OFF))).not.toContain(
      "c.held",
    );
    expect(compile(db, metaSyncBucketCondition("skippedUpcoming", columns, RULE_OFF))).toContain(
      "not ((false) and (c.held))",
    );
  });

  it("names a holder only for a row that passes the rule it is read under", () => {
    const select = (applied?: MetaAutoPublishRule) =>
      db
        .selectFrom("uvsgamesEvents as c")
        .select(heldBySelection("uvsgames", sql`c.external_id`, columns, applied))
        .compile().sql;

    expect(select(rule)).toContain("and (c.passes)");
    expect(select(RULE_OFF)).toContain("and (false)");
    expect(select()).toContain("and (false)");
  });

  it("keeps the joined triage in the aggregate counts", () => {
    const text = db
      .selectFrom("uvsgamesEvents as c")
      .select(metaSyncBucketCountSelections(columns, rule))
      .compile().sql;

    expect(text).toContain(JOINED_UNDECIDED);
    expect(text).not.toContain("not exists");
  });
});

interface BucketListing {
  list: (
    filters: {
      bucket: { name: (typeof META_SYNC_BUCKET_FILTERS)[number]; rule: MetaAutoPublishRule };
    },
    page: { limit: number; offset: number },
  ) => Promise<unknown>;
  passingNoResultsKeys: (rule: MetaAutoPublishRule) => Promise<string[]>;
  triageCounts: () => Promise<unknown>;
  bucketCounts: (filters: { missing?: boolean }, rule: MetaAutoPublishRule) => Promise<unknown>;
  syncOverview: (rule: MetaAutoPublishRule) => Promise<unknown>;
}

const sources: [string, (db: Kysely<Database>) => BucketListing][] = [
  ["uvsgames", uvsgamesEventsRepo],
  ["playloltcg", playloltcgEventsRepo],
  ["playriftbound", playriftboundEventsRepo],
  ["topdeck", topdeckEventsRepo],
];

describe.each(sources)("%s bucket filters", (_name, makeRepo) => {
  it.each(META_SYNC_BUCKET_FILTERS)("filters the %s list through anti-joins", async (bucket) => {
    const recording = createRecordingDb([[], [{ total: "0" }]]);

    await makeRepo(recording.db).list({ bucket: { name: bucket, rule } }, { limit: 50, offset: 0 });

    expect(recording.queries).toHaveLength(2);
    for (const statement of recording.queries) {
      const where = bucketWhere(statement);
      expect(where).toContain("not exists");
      expect(where).not.toContain(JOINED_UNDECIDED);
      expect(where).not.toContain(JOINED_PUBLISHED);
    }
  });

  it("filters the hold list through exists lookups, never a hashed list", async () => {
    const recording = createRecordingDb([[], [{ total: "0" }]]);

    await makeRepo(recording.db).list(
      { bucket: { name: "needsDecision", rule } },
      { limit: 50, offset: 0 },
    );

    const where = bucketWhere(recording.queries[0] ?? "");
    expect(where).toMatch(/not exists \(\s*select 1 from meta_held_source_events h/u);
    expect(where).not.toMatch(/in \(\s*select h\.external_id/u);
  });

  it("selects the passing-without-results keys through anti-joins", async () => {
    const recording = createRecordingDb([[]]);

    await makeRepo(recording.db).passingNoResultsKeys(rule);

    const where = bucketWhere(recording.queries[0] ?? "");
    expect(where).toContain("not exists");
    expect(where).not.toContain(JOINED_UNDECIDED);
  });
});

function selectList(statement: string): string {
  const end = statement.indexOf(' from "');
  expect(end).toBeGreaterThan(-1);
  return statement.slice(0, end);
}

function aliases(list: string): string[] {
  return [...list.matchAll(/ as "(?<alias>\w+)"/gu)].map((match) => match.groups?.alias ?? "");
}

function sharedSelectList(build: (db: Kysely<Database>) => { compile: () => { sql: string } }) {
  return selectList(build(createRecordingDb().db).compile().sql);
}

const NO_OVERVIEW = {
  completed: sql<boolean>`false`,
  decklistPublished: sql<boolean>`false`,
  awaitingResults: sql<boolean>`false`,
  cancelled: sql<boolean>`false`,
};

describe.each(sources)("%s aggregate reads", (_name, makeRepo) => {
  it("counts triage states with the shared selections", async () => {
    const recording = createRecordingDb([[{ new: 1, accepted: 2, dismissed: 3 }]]);

    const counts = await makeRepo(recording.db).triageCounts();

    expect(counts).toEqual({ new: 1, accepted: 2, dismissed: 3 });
    expect(selectList(recording.queries[0] ?? "")).toBe(
      sharedSelectList((db) =>
        db.selectFrom("uvsgamesEvents as c").select(triageCountSelections()),
      ),
    );
  });

  it("skips the bucket counts when no filter narrows the list", async () => {
    const recording = createRecordingDb();

    await expect(makeRepo(recording.db).bucketCounts({}, rule)).resolves.toBeNull();
    expect(recording.queries).toHaveLength(0);
  });

  it("counts narrowed buckets with the shared selections", async () => {
    const recording = createRecordingDb([[{ total: "4" }]]);

    await makeRepo(recording.db).bucketCounts({ missing: true }, rule);

    const statement = recording.queries[0] ?? "";
    expect(aliases(selectList(statement))).toEqual(
      aliases(
        sharedSelectList((db) =>
          db.selectFrom("uvsgamesEvents as c").select(metaSyncBucketCountSelections(columns, rule)),
        ),
      ),
    );
    expect(statement).toContain(`count(*) filter (where ${JOINED_UNDECIDED}) as "undecided"`);
    expect(statement).toContain("where c.missing_since is not null");
  });

  it("reads the sync overview through the shared selections", async () => {
    const recording = createRecordingDb([[{ total: "7", missing: "1" }]]);

    const overview = await makeRepo(recording.db).syncOverview(rule);

    const statement = recording.queries[0] ?? "";
    expect(aliases(selectList(statement))).toEqual(
      aliases(
        sharedSelectList((db) =>
          db
            .selectFrom("uvsgamesEvents as c")
            .select(mirrorOverviewSelections(columns, rule, NO_OVERVIEW)),
        ),
      ),
    );
    expect(statement).toContain(
      `count(*) filter (where (${JOINED_PUBLISHED}) and c.missing_since is not null) as "accepted_missing"`,
    );
    expect(statement).toContain('max("c"."last_seen_at") as "last_seen_at"');
    expect(overview).toMatchObject({ total: 7, missing: 1 });
  });
});
