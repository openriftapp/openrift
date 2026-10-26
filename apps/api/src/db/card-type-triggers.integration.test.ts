import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";

import { createDbContext, insertCard } from "../test/integration-context.js";

const ctx = createDbContext("a0000000-0193-4000-a000-000000000001");

const BARE_CARD = {
  name: "Trigger Bare Card",
  might: null,
  energy: null,
  power: null,
  mightBonus: null,
  keywords: [],
  tags: [],
};

describe.skipIf(!ctx)("card type junction triggers (integration)", () => {
  const { db } = ctx!;

  const createdSlugs = ["TRG193-BARE", "TRG193-MULTI", "TRG193-SINGLE"];

  afterAll(async () => {
    // card_card_types rows cascade with the card
    await db.deleteFrom("cards").where("slug", "in", createdSlugs).execute();
  });

  it("rejects a card inserted without any junction row", async () => {
    await expect(
      db
        .insertInto("cards")
        .values({ ...BARE_CARD, slug: "TRG193-BARE" })
        .execute(),
    ).rejects.toThrow(/must have at least one card_card_types row/u);

    const row = await db
      .selectFrom("cards")
      .select("id")
      .where("slug", "=", "TRG193-BARE")
      .executeTakeFirst();
    expect(row).toBeUndefined();
  });

  it("accepts a card and its ordered types written in one transaction", async () => {
    const card = await insertCard(db, {
      ...BARE_CARD,
      slug: "TRG193-MULTI",
      name: "Trigger Unit Gear",
      types: ["unit", "gear"],
    });

    const junction = await db
      .selectFrom("cardCardTypes")
      .select("typeSlug")
      .where("cardId", "=", card.id)
      .orderBy("position")
      .execute();
    expect(junction.map((row) => row.typeSlug)).toEqual(["unit", "gear"]);
  });

  it("rejects a transaction that leaves a card with zero junction rows", async () => {
    const card = await insertCard(db, { ...BARE_CARD, slug: "TRG193-SINGLE" });

    await expect(
      db.deleteFrom("cardCardTypes").where("cardId", "=", card.id).execute(),
    ).rejects.toThrow(/at least one card_card_types row/u);

    const junction = await db
      .selectFrom("cardCardTypes")
      .select("typeSlug")
      .where("cardId", "=", card.id)
      .execute();
    expect(junction).toHaveLength(1);
  });

  it("lets a card delete cascade without a false rejection", async () => {
    const card = await insertCard(db, {
      ...BARE_CARD,
      slug: "TRG193-CASCADE",
      name: "Trigger Cascade Card",
      types: ["spell"],
    });

    await db.deleteFrom("cards").where("id", "=", card.id).execute();

    const orphaned = await sql<{ count: number }>`
      SELECT count(*)::int AS count FROM card_card_types WHERE card_id = ${card.id}
    `.execute(db);
    expect(orphaned.rows[0]!.count).toBe(0);
  });
});
