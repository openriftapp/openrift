import { META_SYNC_BUCKET_FILTERS } from "@openrift/shared/meta-sync-buckets";
import type { Kysely } from "kysely";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";

import type { Database } from "../../../db/tables.js";
import { createRecordingDb } from "../../../test/recording-db.js";
import type { MetaAutoPublishRule, MetaSyncBucketColumns } from "./meta-sync-buckets.js";
import { metaSyncBucketCondition, metaSyncBucketCountSelections } from "./meta-sync-buckets.js";
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
  passes: () => sql`c.passes`,
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

  it("selects the passing-without-results keys through anti-joins", async () => {
    const recording = createRecordingDb([[]]);

    await makeRepo(recording.db).passingNoResultsKeys(rule);

    const where = bucketWhere(recording.queries[0] ?? "");
    expect(where).toContain("not exists");
    expect(where).not.toContain(JOINED_UNDECIDED);
  });
});
