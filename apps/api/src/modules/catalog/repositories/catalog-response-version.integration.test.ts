import type { Transaction } from "kysely";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";

import type { Database } from "../../../db/tables.js";
import { createDbContext } from "../../../test/integration-context.js";
import { catalogRepo } from "./catalog.js";

const ctx = createDbContext("a0000000-0042-4000-a000-000000000001");

/**
 * `catalogResponseVersion` is the ETag of `GET /catalog`, cached `immutable, max-age=1y`.
 * Nothing in the type system ties it to `assembleCatalogResponse`'s source tables: a field
 * sourced from a new table needs a version trigger (migrations 343, 345) and a case here.
 *
 * Each case mutates and re-reads the token inside one rolled-back transaction that holds
 * the version rows, so other files' commits cannot move it. Version triggers are deferred
 * to commit; the cases fire them early with `SET CONSTRAINTS ALL IMMEDIATE`.
 */
class RollbackError extends Error {
  override name = "RollbackError";
}

describe.skipIf(!ctx)("catalogResponseVersion (integration)", () => {
  const { db } = ctx!;

  async function inRolledBackTx<T>(fn: (trx: Transaction<Database>) => Promise<T>): Promise<T> {
    let result!: T;
    try {
      await db.transaction().execute(async (trx: Transaction<Database>) => {
        await sql`SELECT 1 FROM catalog_versions ORDER BY scope FOR UPDATE`.execute(trx);
        result = await fn(trx);
        throw new RollbackError();
      });
    } catch (error) {
      if (!(error instanceof RollbackError)) {
        throw error;
      }
    }
    return result;
  }

  function tokenAround(statements: string[]): Promise<{ before: string; after: string }> {
    return inRolledBackTx(async (trx) => {
      const repo = catalogRepo(trx);
      const before = await repo.catalogResponseVersion();
      for (const statement of statements) {
        await sql.raw(statement).execute(trx);
      }
      await fireDeferredTriggers(trx);
      return { before, after: await repo.catalogResponseVersion() };
    });
  }

  function fireDeferredTriggers(trx: Transaction<Database>) {
    return sql`SET CONSTRAINTS ALL IMMEDIATE`.execute(trx);
  }

  /** Rows affected by `statements`, so a vacuous no-op can't pass silently. */
  function affectedRows(statements: string[]): Promise<number> {
    return inRolledBackTx(async (trx) => {
      let total = 0;
      for (const statement of statements) {
        const result = await sql.raw(statement).execute(trx);
        total += Number(result.numAffectedRows ?? 0);
      }
      return total;
    });
  }

  // An in-place edit the token must notice. These tables carry a timestamp, so
  // bumping it on one row stands in for any field edit. The token reads max(),
  // so the bump has to clear the table's own max: a concurrent suite's write
  // can already sit ahead of this transaction's now().
  const touch = (table: string, column = "updated_at") =>
    `UPDATE ${table}
        SET ${column} = greatest(now(), (SELECT max(${column}) FROM ${table})) + interval '1 second'
      WHERE ctid = (SELECT ctid FROM ${table} LIMIT 1)`;

  /** A delete, for tables the token covers by count or by content hash. */
  const dropOne = (table: string) =>
    `DELETE FROM ${table} WHERE ctid = (SELECT ctid FROM ${table} LIMIT 1)`;

  // custom_tags is absent from the seed, so the probe has to create the rows.
  const ADD_CUSTOM_TAG = [
    `INSERT INTO custom_tag_categories (id, slug, label)
     VALUES ('a0000000-0042-4000-a000-0000000000c1', 'probe-cat', 'Probe Category')`,
    `INSERT INTO custom_tags (id, slug, label, category_id)
     VALUES ('a0000000-0042-4000-a000-0000000000c2', 'probe-tag', 'Probe Tag',
             'a0000000-0042-4000-a000-0000000000c1')`,
    `INSERT INTO card_custom_tags (card_id, custom_tag_id)
     SELECT id, 'a0000000-0042-4000-a000-0000000000c2' FROM cards LIMIT 1`,
  ];

  const relabel = (table: string, column = "label") =>
    `UPDATE ${table} SET ${column} = ${column} || ' (probe)'
      WHERE ctid = (SELECT ctid FROM ${table} LIMIT 1)`;

  const ADD_TAG_CATEGORY = `INSERT INTO tag_categories (id, slug, label)
     VALUES ('a0000000-0042-4000-a000-0000000000f1', 'probe-category', 'Probe Category')`;

  // printing_citations is empty in the seed, so the mutation has to create the
  // row — which is also the realistic case: an admin citing a promo's source
  // for the first time must roll the token.
  const ADD_CITATION = [
    `INSERT INTO printing_citations (id, printing_id, label, source_url)
     SELECT 'a0000000-0042-4000-a000-0000000000d1', id, 'Probe citation',
            'https://example.test/probe'
       FROM printings LIMIT 1`,
  ];

  const CASES: { table: string; why: string; statements: string[] }[] = [
    { table: "cards", why: "cards map", statements: [touch("cards")] },
    { table: "printings", why: "printings map", statements: [touch("printings")] },
    { table: "sets", why: "sets array", statements: [touch("sets")] },
    {
      table: "set_releases",
      why: "per-language release dates",
      statements: [touch("set_releases")],
    },
    { table: "markers", why: "printing.markers", statements: [touch("markers")] },
    {
      table: "distribution_channels",
      why: "printing.distributionChannels",
      statements: [touch("distribution_channels")],
    },
    { table: "faces", why: "printing fields", statements: [touch("faces")] },
    { table: "face_images", why: "printing.images", statements: [touch("face_images")] },
    {
      table: "image_files",
      why: "printing.images credit",
      statements: [touch("image_files")],
    },
    {
      table: "card_bans",
      why: "a ban's start day",
      statements: [
        "UPDATE card_bans SET banned_at = banned_at - 1 WHERE ctid = (SELECT ctid FROM card_bans LIMIT 1)",
      ],
    },
    {
      table: "card_bans",
      why: "an unban",
      statements: [
        `UPDATE card_bans SET unbanned_at = banned_at
          WHERE ctid = (SELECT ctid FROM card_bans WHERE unbanned_at IS NULL LIMIT 1)`,
      ],
    },
    {
      table: "card_errata",
      why: "card.errata",
      statements: [
        `UPDATE card_errata SET corrected_rules_text = coalesce(corrected_rules_text, '') || ' (probe)'
          WHERE ctid = (SELECT ctid FROM card_errata LIMIT 1)`,
      ],
    },
    {
      table: "errata_announcements",
      why: "card.errata source",
      statements: [
        `INSERT INTO errata_announcements (id, name, published_on, url)
         VALUES ('a0000000-0042-4000-a000-0000000000e1', 'Probe announcement', '2026-01-01',
                 'https://example.test/probe-errata')`,
      ],
    },
    { table: "card_domains", why: "card.domains", statements: [dropOne("card_domains")] },
    {
      table: "card_card_types",
      why: "card.types",
      statements: [
        `INSERT INTO card_card_types (card_id, type_slug, position)
         SELECT c.id, t.slug, 99 FROM cards c CROSS JOIN card_types t
          WHERE NOT EXISTS (
            SELECT 1 FROM card_card_types x WHERE x.card_id = c.id AND x.type_slug = t.slug
          )
          LIMIT 1`,
      ],
    },
    {
      table: "card_tokens",
      why: "card.tokenCardIds",
      statements: [
        `INSERT INTO card_tokens (card_id, token_card_id)
         SELECT a.id, b.id FROM cards a CROSS JOIN cards b
          WHERE a.id <> b.id
            AND NOT EXISTS (
              SELECT 1 FROM card_tokens x WHERE x.card_id = a.id AND x.token_card_id = b.id
            )
          LIMIT 1`,
      ],
    },
    { table: "formats", why: "card.bans formatName", statements: [relabel("formats", "name")] },
    {
      table: "card_super_types",
      why: "card.superTypes",
      statements: [dropOne("card_super_types")],
    },
    { table: "printing_citations", why: "printing.citations", statements: ADD_CITATION },
    ...[
      "card_types",
      "super_types",
      "domains",
      "rarities",
      "finishes",
      "art_variants",
      "card_sizes",
    ].map((table) => ({ table, why: "enums block", statements: [relabel(table)] })),
    { table: "languages", why: "enums block", statements: [relabel("languages", "name")] },
    {
      table: "keywords",
      why: "keywords block",
      statements: [
        `UPDATE keywords SET color = CASE WHEN color = '#123456' THEN '#654321' ELSE '#123456' END
          WHERE ctid = (SELECT ctid FROM keywords LIMIT 1)`,
      ],
    },
    {
      table: "keyword_translations",
      why: "keywords block translations",
      statements: [relabel("keyword_translations")],
    },
    { table: "tag_categories", why: "tagCategories block", statements: [ADD_TAG_CATEGORY] },
    {
      table: "tag_definitions",
      why: "tagCategoryMap block",
      statements: [
        ADD_TAG_CATEGORY,
        `INSERT INTO tag_definitions (tag, category_id)
         VALUES ('Probe Tag', 'a0000000-0042-4000-a000-0000000000f1')`,
      ],
    },
  ];

  it.each(CASES)("rolls when $table changes ($why)", async ({ statements }) => {
    // A statement that hits no rows would pass vacuously.
    expect(await affectedRows(statements), "mutation affected no rows").toBeGreaterThan(0);

    const { before, after } = await tokenAround(statements);
    expect(after).not.toBe(before);
  });

  // The junction below has no updated_at/timestamp column.
  const SWAPS: { table: string; other: string; column: string }[] = [
    {
      table: "printing_distribution_channels",
      other: "distribution_channels",
      column: "channel_id",
    },
  ];

  it.each(SWAPS)(
    "rolls when $table swaps a link without changing its row count",
    async ({ table, other, column }) => {
      const swap = [
        dropOne(table),
        `INSERT INTO ${table} (printing_id, ${column})
         SELECT p.id, o.id FROM printings p CROSS JOIN ${other} o
         WHERE NOT EXISTS (
           SELECT 1 FROM ${table} x WHERE x.printing_id = p.id AND x.${column} = o.id
         )
         LIMIT 1`,
      ];
      // Must stay 1-for-1, or this stops testing the content hash and tests count(*) instead.
      expect(await affectedRows(swap)).toBe(2);

      const { before, after } = await tokenAround(swap);
      expect(after).not.toBe(before);
    },
  );

  // printing_citations also has no `updated_at`.
  it("rolls when a citation is edited in place", async () => {
    const edit = [
      ...ADD_CITATION,
      `UPDATE printing_citations SET label = 'Probe citation (corrected)'
        WHERE id = 'a0000000-0042-4000-a000-0000000000d1'`,
    ];
    expect(await affectedRows(edit)).toBe(2);

    const { before, after } = await tokenAround(edit);
    expect(after).not.toBe(before);
  });

  it("is stable when nothing changes", async () => {
    const { before, after } = await tokenAround([]);
    expect(after).toBe(before);
  });

  it("is stable when an update rewrites a row with its own values", async () => {
    const noop = [
      `UPDATE rarities SET label = label WHERE ctid = (SELECT ctid FROM rarities LIMIT 1)`,
    ];
    expect(await affectedRows(noop)).toBe(1);

    const { before, after } = await tokenAround(noop);
    expect(after).toBe(before);
  });

  it("rolls when the catalog views are refreshed", async () => {
    const { before, after } = await inRolledBackTx(async (trx) => {
      const repo = catalogRepo(trx);
      const tokenBefore = await repo.catalogResponseVersion();
      await repo.refreshCardAggregates();
      return { before: tokenBefore, after: await repo.catalogResponseVersion() };
    });
    expect(after).not.toBe(before);
  });

  // These two zones are always 25 hours apart, so they never share a calendar date.
  const AHEAD = "Pacific/Kiritimati"; // UTC+14
  const BEHIND = "Pacific/Midway"; // UTC-11

  function tokensInZones(read: "response" | "rule"): Promise<[string, string]> {
    return inRolledBackTx(async (trx) => {
      const repo = catalogRepo(trx);
      const tokenIn = async (zone: string) => {
        await sql.raw(`SET LOCAL TIME ZONE '${zone}'`).execute(trx);
        return read === "response" ? repo.catalogResponseVersion() : repo.catalogContentVersion();
      };
      return [await tokenIn(AHEAD), await tokenIn(BEHIND)];
    });
  }

  it("verifies the two probe zones really are on different dates", async () => {
    const dateIn = (zone: string) =>
      inRolledBackTx(async (trx) => {
        await sql.raw(`SET LOCAL TIME ZONE '${zone}'`).execute(trx);
        const r = await sql<{ d: string }>`SELECT current_date::text AS d`.execute(trx);
        return r.rows[0]?.d ?? "";
      });
    expect(await dateIn(AHEAD)).not.toBe(await dateIn(BEHIND));
  });

  // The response carries no date-derived field — `CatalogSetRow` has no
  // `released` boolean on purpose, clients derive it from the raw dates. So the
  // ETag must not move across midnight, or every client's year-long `immutable`
  // entry is discarded daily for bytes that did not change.
  it("does not fold the calendar date into the response token", async () => {
    const [ahead, behind] = await tokensInZones("response");
    expect(ahead).toBe(behind);
  });

  // The rule memo does guard a date-derived value (`setReleased`), so its token
  // must still move.
  it("still folds the calendar date into the rule token", async () => {
    const [ahead, behind] = await tokensInZones("rule");
    expect(ahead).not.toBe(behind);
  });

  // The counterweight to every assertion above: a token that rolled on any
  // write would satisfy them while destroying the edge cache hit rate. Prices
  // are refreshed daily and are deliberately NOT part of the catalog response.
  it("does not roll for a price refresh", async () => {
    const refresh = [
      `UPDATE marketplace_product_prices SET market_cents = coalesce(market_cents, 0) + 1
       WHERE ctid = (SELECT ctid FROM marketplace_product_prices LIMIT 1)`,
    ];
    expect(await affectedRows(refresh)).toBeGreaterThan(0);

    const { before, after } = await tokenAround(refresh);
    expect(after).toBe(before);
  });

  it("does not roll when a copy is added or removed", async () => {
    const remove = [dropOne("copies")];
    expect(await affectedRows(remove)).toBeGreaterThan(0);

    const { before, after } = await tokenAround(remove);
    expect(after).toBe(before);
  });

  it("does not roll when a custom tag is assigned", async () => {
    const { before, after } = await tokenAround(ADD_CUSTOM_TAG);
    expect(after).toBe(before);
  });

  it("rolls the rule token when a custom tag is assigned", async () => {
    const { before, after } = await inRolledBackTx(async (trx) => {
      const repo = catalogRepo(trx);
      const tokenBefore = await repo.catalogContentVersion();
      for (const statement of ADD_CUSTOM_TAG) {
        await sql.raw(statement).execute(trx);
      }
      await fireDeferredTriggers(trx);
      return { before: tokenBefore, after: await repo.catalogContentVersion() };
    });
    expect(after).not.toBe(before);
  });
});
