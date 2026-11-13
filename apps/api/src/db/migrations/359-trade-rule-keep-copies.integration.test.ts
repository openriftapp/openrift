import type { Kysely } from "kysely";
import { CamelCasePlugin, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedTestUser } from "../../test/integration-context.js";
import { setupTestDb } from "../../test/integration-setup.js";
import type { Database } from "../tables.js";
import { down, up } from "./359-trade-rule-keep-copies.js";

const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)("migration 359 trade-rule-keep-copies", () => {
  let db: Kysely<Database>;
  let teardown: () => Promise<void>;
  let listId: string;

  const tradeRule = (key: string, copyIds: string[]) => ({
    kind: "trade",
    filter: {},
    collectionIds: null,
    keepPerCard: { mode: "fixed", n: 3 },
    [key]: copyIds,
  });
  const wishRule = { kind: "wish", filter: {}, quantity: { mode: "fixed", n: 1 }, excludeIds: [] };

  async function readRules(): Promise<unknown> {
    const { rows } = await sql<{
      rules: unknown;
    }>`SELECT rules FROM lists WHERE id = ${listId}`.execute(db);
    return rows[0]?.rules;
  }

  beforeAll(async () => {
    ({ db, teardown } = await setupTestDb(DATABASE_URL!, "migration_keep_copies"));
    const user = await seedTestUser(db.withPlugin(new CamelCasePlugin()));
    const rules = [tradeRule("excludeCopyIds", ["copy-1", "copy-2"]), wishRule];
    const { rows } = await sql<{ id: string }>`
      INSERT INTO lists (user_id, name, intent, kind, rules)
      VALUES (${user.id}, 'Summoner Skirmish haves', 'trade', 'copy', ${JSON.stringify(rules)}::text::jsonb)
      RETURNING id
    `.execute(db);
    listId = rows[0]!.id;
  });

  afterAll(async () => {
    await teardown();
  });

  it("up turns copy exclusions into kept copies and leaves other rules alone", async () => {
    await up(db as Kysely<unknown>);
    expect(await readRules()).toEqual([tradeRule("keepCopyIds", ["copy-1", "copy-2"]), wishRule]);
  });

  it("down turns kept copies back into exclusions", async () => {
    await down(db as Kysely<unknown>);
    expect(await readRules()).toEqual([
      tradeRule("excludeCopyIds", ["copy-1", "copy-2"]),
      wishRule,
    ]);
  });
});
