import type { Expression, SqlBool } from "kysely";
import {
  CamelCasePlugin,
  DummyDriver,
  expressionBuilder,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";
import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "../db/tables.js";
import { AppError } from "../errors.js";
import { buildKeysetCursor } from "../lib/keyset-cursor.js";
import { createRecordingDb, onlyStatement } from "../test/recording-db.js";
import {
  currentSafeXid,
  imageId,
  imageUrlWithOriginal,
  inTransaction,
  joinFrontImage,
  keysetCursorPredicate,
  offsetPage,
  reorderBySortOrder,
  requireFrontImage,
  selectCopyWithCard,
} from "./query-helpers.js";

const compileDb = new Kysely<Database>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (db) => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
  plugins: [new CamelCasePlugin()],
});

const captured = createRecordingDb();
const { db } = captured;

function compileWhere(predicate: Expression<SqlBool>) {
  const compiled = compileDb.selectFrom("copies as cp").select("cp.id").where(predicate).compile();
  return {
    where: compiled.sql.slice(compiled.sql.indexOf(" where ") + " where ".length),
    parameters: compiled.parameters,
  };
}

describe("imageId", () => {
  it("returns a raw builder expression", () => {
    const result = imageId("pi");
    expect(result).toBeDefined();
  });
});

describe("imageUrlWithOriginal", () => {
  it("returns a raw builder expression", () => {
    const result = imageUrlWithOriginal("pi");
    expect(result).toBeDefined();
  });
});

describe("joinFrontImage", () => {
  it("left-joins the active front image of the p-aliased printing", () => {
    const { sql, parameters } = joinFrontImage(compileDb.selectFrom("printings as p"))
      .select(["p.id", imageId("imgf").as("imageId")])
      .compile();

    expect(sql).toContain(
      'left join "printing_images" as "pi" on "pi"."printing_id" = "p"."id" and "pi"."face" = $1 and "pi"."is_active" = $2',
    );
    expect(sql).toContain(
      'left join "image_files" as "imgf" on "imgf"."id" = "pi"."image_file_id"',
    );
    expect(parameters).toEqual(["front", true]);
  });

  it("keeps rows whose printing has no image (left, not inner)", () => {
    const { sql } = joinFrontImage(compileDb.selectFrom("printings as p")).select("p.id").compile();

    expect(sql).not.toContain("inner join");
  });

  it("resolves p against a view as readily as the base table", () => {
    const { sql } = joinFrontImage(compileDb.selectFrom("printingsOrdered as p"))
      .select("p.id")
      .compile();

    expect(sql).toContain('from "printings_ordered" as "p"');
    expect(sql).toContain('"pi"."printing_id" = "p"."id"');
  });
});

describe("requireFrontImage", () => {
  it("inner-joins the front image off the given printing reference", () => {
    const { sql, parameters } = requireFrontImage(
      compileDb.selectFrom("copies as cp"),
      "cp.printingId",
    )
      .select(["cp.id", "imgf.id as imageId"])
      .compile();

    expect(sql).toContain(
      'inner join "printing_images" as "pim" on "pim"."printing_id" = "cp"."printing_id" and "pim"."face" = $1 and "pim"."is_active" = $2',
    );
    expect(sql).toContain(
      'inner join "image_files" as "imgf" on "imgf"."id" = "pim"."image_file_id"',
    );
    expect(parameters).toEqual(["front", true]);
  });

  it("drops rows whose printing has no image (inner, not left)", () => {
    const { sql } = requireFrontImage(compileDb.selectFrom("copies as cp"), "cp.printingId")
      .select("cp.id")
      .compile();

    expect(sql).not.toContain("left join");
  });
});

describe("selectCopyWithCard", () => {
  it("joins copies through printings and cards to the front image", () => {
    const { sql } = selectCopyWithCard(compileDb)
      .select(["cp.id", "c.name", imageId("imgf").as("imageId")])
      .compile();

    expect(sql).toContain('from "copies" as "cp"');
    expect(sql).toContain('inner join "printings" as "p" on "p"."id" = "cp"."printing_id"');
    expect(sql).toContain('inner join "cards" as "c" on "c"."id" = "p"."card_id"');
    expect(sql).toContain('left join "printing_images" as "pi"');
    expect(sql).toContain('left join "image_files" as "imgf"');
  });
});

describe("keysetCursorPredicate", () => {
  const TIME = new Date("2026-01-15T12:30:00.000Z");
  const BOUND = new Date("2026-01-15T12:30:00.001Z");
  const OPTIONS = { timeColumn: "cp.createdAt", idColumn: "cp.id" } as const;

  it("breaks ties ascending on the id column", () => {
    const { where, parameters } = compileWhere(
      keysetCursorPredicate(buildKeysetCursor(TIME, "cp-9"), { ...OPTIONS, idDirection: "asc" }),
    );
    expect(where).toBe(
      `("cp"."created_at" < $1 and ` +
        `(date_trunc('milliseconds', "cp"."created_at") < $2 or ` +
        `(date_trunc('milliseconds', "cp"."created_at") = $3 and "cp"."id" > $4)))`,
    );
    expect(parameters).toEqual([BOUND, TIME, TIME, "cp-9"]);
  });

  it("breaks ties descending on the id column", () => {
    const { where, parameters } = compileWhere(
      keysetCursorPredicate(buildKeysetCursor(TIME, "cp-9"), { ...OPTIONS, idDirection: "desc" }),
    );
    expect(where).toBe(
      `("cp"."created_at" < $1 and ` +
        `(date_trunc('milliseconds', "cp"."created_at") < $2 or ` +
        `(date_trunc('milliseconds', "cp"."created_at") = $3 and "cp"."id" < $4)))`,
    );
    expect(parameters).toEqual([BOUND, TIME, TIME, "cp-9"]);
  });

  // date_trunc is STABLE: the truncated comparison alone is unsargable, so
  // the bare-column bound must be present in both branches.
  it("adds a bare-column upper bound an index can seek on", () => {
    const withId = compileWhere(
      keysetCursorPredicate(buildKeysetCursor(TIME, "cp-9"), { ...OPTIONS, idDirection: "asc" }),
    );
    const legacy = compileWhere(
      keysetCursorPredicate(TIME.toISOString(), { ...OPTIONS, idDirection: "asc" }),
    );
    for (const compiled of [withId, legacy]) {
      expect(compiled.where).toContain(`"cp"."created_at" < $1`);
      expect(compiled.parameters[0]).toEqual(BOUND);
    }
  });

  // A row one microsecond past the cursor still truncates back onto it, so
  // one millisecond above is the exact width that keeps it a tie.
  it("keeps the bound one millisecond above the cursor so ties survive", () => {
    const { parameters } = compileWhere(
      keysetCursorPredicate(buildKeysetCursor(TIME, "cp-9"), { ...OPTIONS, idDirection: "asc" }),
    );
    expect(parameters[0]).toEqual(new Date(TIME.getTime() + 1));
  });

  // A cursor minted before the id suffix shipped is still in flight during a
  // deploy: it must degrade to the timestamp-only comparison, not throw.
  it("compares on time alone for a legacy timestamp-only cursor", () => {
    const { where, parameters } = compileWhere(
      keysetCursorPredicate(TIME.toISOString(), { ...OPTIONS, idDirection: "asc" }),
    );
    expect(where).toBe(
      `("cp"."created_at" < $1 and date_trunc('milliseconds', "cp"."created_at") < $2)`,
    );
    expect(parameters).toEqual([BOUND, TIME]);
  });

  it("keeps the id when it contains the separator", () => {
    const { parameters } = compileWhere(
      keysetCursorPredicate(`${TIME.toISOString()}_a_b`, { ...OPTIONS, idDirection: "asc" }),
    );
    expect(parameters).toEqual([BOUND, TIME, TIME, "a_b"]);
  });

  it("rejects an unparseable cursor with a 400", () => {
    const parse = () => keysetCursorPredicate("not-a-date", { ...OPTIONS, idDirection: "asc" });
    expect(parse).toThrow(AppError);
    expect(parse).toThrow(/Invalid cursor/u);
    try {
      parse();
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as AppError).status).toBe(400);
    }
  });
});

describe("reorderBySortOrder", () => {
  beforeEach(() => {
    captured.reset();
  });

  it("assigns 0-based positions in the given key order", async () => {
    await reorderBySortOrder(db, {
      table: "finishes",
      keyColumn: "slug",
      keys: ["holofoil", "normal"],
    });

    const { sql, parameters } = onlyStatement(captured);
    expect(sql).toBe(
      'update "finishes" set sort_order = d.new_order ' +
        "from (values ($1::text, $2::int), ($3::text, $4::int)) as d(key, new_order) " +
        'where "finishes"."slug" = d.key',
    );
    expect(parameters).toEqual(["holofoil", 0, "normal", 1]);
  });

  it("converts camelCase table and column names to snake_case", async () => {
    await reorderBySortOrder(db, {
      table: "artVariants",
      keyColumn: "slug",
      keys: ["alternate-art"],
    });

    const { sql } = onlyStatement(captured);
    expect(sql).toContain('update "art_variants"');
    expect(sql).toContain('where "art_variants"."slug" = d.key');
  });

  it("casts uuid keys so Postgres can infer the VALUES column type", async () => {
    const id = "11111111-2222-4333-8444-555555555555";
    await reorderBySortOrder(db, {
      table: "markers",
      keyColumn: "id",
      keys: [id],
      keyType: "uuid",
    });

    const { sql, parameters } = onlyStatement(captured);
    expect(sql).toContain("(values ($1::uuid, $2::int))");
    expect(sql).toContain('where "markers"."id" = d.key');
    expect(parameters).toEqual([id, 0]);
  });

  it("addresses a non-slug key column", async () => {
    await reorderBySortOrder(db, { table: "languages", keyColumn: "code", keys: ["EN", "KR"] });

    const { sql, parameters } = onlyStatement(captured);
    expect(sql).toContain('where "languages"."code" = d.key');
    expect(parameters).toEqual(["EN", 0, "KR", 1]);
  });

  it("issues no statement for an empty key list", async () => {
    await reorderBySortOrder(db, { table: "finishes", keyColumn: "slug", keys: [] });

    expect(captured.statements).toHaveLength(0);
  });
});

describe("reorderBySortOrder scope", () => {
  beforeEach(() => {
    captured.reset();
  });

  it("appends the scope condition to the where clause", async () => {
    await reorderBySortOrder(db, {
      table: "deckFolders",
      keyColumn: "id",
      keys: ["f1"],
      keyType: "uuid",
      scope: expressionBuilder<Database, "deckFolders">()("deckFolders.userId", "=", "u1"),
    });

    const { sql: text, parameters } = onlyStatement(captured);
    expect(text).toContain('where "deck_folders"."id" = d.key and "deck_folders"."user_id" = $3');
    expect(parameters).toEqual(["f1", 0, "u1"]);
  });
});

describe("currentSafeXid", () => {
  beforeEach(() => {
    captured.reset();
  });

  it("reads the snapshot xmin as text", async () => {
    captured.setRows([{ xid: "4242" }]);

    await expect(currentSafeXid(db)).resolves.toBe("4242");
    expect(onlyStatement(captured).sql).toBe(
      'select pg_snapshot_xmin(pg_current_snapshot())::text as "xid"',
    );
  });

  it("rejects when the database returns no row", async () => {
    await expect(currentSafeXid(db)).rejects.toThrow();
  });
});

describe("inTransaction", () => {
  beforeEach(() => {
    captured.reset();
  });

  it("opens a transaction on a plain connection", async () => {
    const result = await inTransaction(db, async (trx) => {
      expect(trx.isTransaction).toBe(true);
      return "done";
    });

    expect(result).toBe("done");
    expect(captured.events).toEqual(["begin", "commit"]);
  });

  it("reuses an enclosing transaction instead of nesting", async () => {
    await db.transaction().execute(async (outer) => {
      await inTransaction(outer, async (trx) => {
        expect(trx).toBe(outer);
      });
    });

    expect(captured.events).toEqual(["begin", "commit"]);
  });

  it("rolls back when the callback throws", async () => {
    await expect(inTransaction(db, () => Promise.reject(new Error("boom")))).rejects.toThrow(
      "boom",
    );
    expect(captured.events).toEqual(["begin", "rollback"]);
  });
});

describe("offsetPage", () => {
  it("pages the base query and counts it with the same filters", async () => {
    const recording = createRecordingDb([[{ id: "r1" }, { id: "r2" }], [{ total: "7" }]]);
    const base = recording.db
      .selectFrom("jobRuns")
      .select(["id"])
      .where("kind", "=", "tcgplayer.refresh")
      .orderBy("startedAt", "desc");

    const page = await offsetPage(base, { limit: 2, offset: 4 });

    expect(page).toEqual({ rows: [{ id: "r1" }, { id: "r2" }], total: 7 });
    const [rowSql, countSql] = recording.queries;
    expect(rowSql).toBe(
      'select "id" from "job_runs" where "kind" = $1 order by "started_at" desc limit $2 offset $3',
    );
    expect(countSql).toBe('select count(*) as "total" from "job_runs" where "kind" = $1');
    expect(recording.parameters).toEqual([["tcgplayer.refresh", 2, 4], ["tcgplayer.refresh"]]);
  });

  it("reports zero total for an empty result", async () => {
    const recording = createRecordingDb([[], [{ total: "0" }]]);
    const page = await offsetPage(recording.db.selectFrom("jobRuns").select("id"), {
      limit: 10,
      offset: 0,
    });

    expect(page).toEqual({ rows: [], total: 0 });
  });

  it("rejects when the query fails", async () => {
    const recording = createRecordingDb([new Error("db down"), [{ total: "0" }]]);
    await expect(
      offsetPage(recording.db.selectFrom("jobRuns").select("id"), { limit: 1, offset: 0 }),
    ).rejects.toThrow("db down");
  });
});

describe("joinFrontImage alias", () => {
  it("joins off a printing under a custom alias", () => {
    const { sql: text } = joinFrontImage(compileDb.selectFrom("printings as pr"), "pr")
      .select("pr.id")
      .compile();

    expect(text).toContain('"pi"."printing_id" = "pr"."id"');
  });
});
