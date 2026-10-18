import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDbContext,
  deletePrintingsByFace,
  insertPrinting,
  seedTestUser,
} from "../../../test/integration-context.js";
import { collectionsRepo } from "../../collections/repositories/collections.js";
import { copiesRepo } from "../../collections/repositories/copies.js";
import type { PairMergeList } from "./pair-merge.js";
import { applyPairMerge, PairMergeError, planPairMerge } from "./pair-merge.js";

// Uses the shared integration database. Requires INTEGRATION_DB_URL.
// Uses prefix PMG- for entities it creates.

const USER_ID = crypto.randomUUID();
const ctx = createDbContext(USER_ID);

describe.skipIf(!ctx)("pair merge (integration)", () => {
  const { db } = ctx!;
  const cardIds: Record<string, string> = {};
  const slugs: Record<string, string> = {};
  const printingIds: Record<string, string> = {};
  let setId = "";
  let collectionId = "";
  let listId = "";
  let deckId = "";

  async function seedSide(card: string, code: string) {
    const { id } = await insertPrinting(db, {
      cardId: cardIds[card]!,
      setId,
      shortCode: code,
      rarity: "common",
      artVariant: "normal",
      isSigned: false,
      finish: "normal",
      size: "standard",
      artist: "PMG Artist",
      publicCode: code,
      printedRulesText: null,
      printedEffectText: null,
      flavorText: null,
      comment: null,
      language: "EN",
    });
    const row = await db
      .selectFrom("printings")
      .select("slug")
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    printingIds[code] = id;
    slugs[code] = row.slug;
  }

  function list(): PairMergeList {
    return {
      printings: [
        { key: "bird-gold", sides: [slugs["PMG-T01"]!, slugs["PMG-T05"]!] },
        { key: "bird-brush", sides: [slugs["PMG-T01"]!, slugs["PMG-T03"]!] },
      ],
      homes: { [slugs["PMG-T01"]!]: "bird-gold" },
    };
  }

  beforeAll(async () => {
    await seedTestUser(db, { id: USER_ID });
    const [set] = await db
      .insertInto("sets")
      .values({ slug: "PMG-TEST", name: "PMG Test Set", printedTotal: 10, sortOrder: 942 })
      .returning("id")
      .execute();
    setId = set!.id;
    for (const name of ["Bird", "Gold", "Brush"]) {
      const [card] = await db
        .insertInto("cards")
        .values({
          name,
          slug: `pmg-${name.toLowerCase()}`,
          type: "other",
          normName: `pmg-${name.toLowerCase()}`,
          keywords: [],
          tags: [],
        })
        .returning("id")
        .execute();
      cardIds[name] = card!.id;
    }
    await seedSide("Bird", "PMG-T01");
    await seedSide("Gold", "PMG-T05");
    await seedSide("Brush", "PMG-T03");

    const collection = await collectionsRepo(db).create({
      userId: USER_ID,
      groupId: null,
      name: "PMG binder",
      description: null,
      isInbox: false,
      sortOrder: 0,
    });
    collectionId = collection.id;
    await copiesRepo(db).insertBatch([
      { printingId: printingIds["PMG-T01"]!, collectionId },
      { printingId: printingIds["PMG-T01"]!, collectionId },
      { printingId: printingIds["PMG-T05"]!, collectionId },
      { printingId: printingIds["PMG-T03"]!, collectionId },
    ]);

    const [entryList] = await db
      .insertInto("lists")
      .values({ userId: USER_ID, name: "PMG wants", kind: "printing", intent: "wish" } as never)
      .returning("id")
      .execute();
    listId = entryList!.id;
    await db
      .insertInto("listEntries")
      .values([
        {
          listId,
          userId: USER_ID,
          kind: "printing",
          printingId: printingIds["PMG-T01"]!,
          quantity: 1,
        },
        {
          listId,
          userId: USER_ID,
          kind: "printing",
          printingId: printingIds["PMG-T05"]!,
          quantity: 2,
        },
      ] as never)
      .execute();

    const [deck] = await db
      .insertInto("decks")
      .values({ userId: USER_ID, name: "PMG deck", format: "constructed" } as never)
      .returning("id")
      .execute();
    deckId = deck!.id;
    await db
      .insertInto("deckCards")
      .values({
        deckId,
        cardId: cardIds.Gold!,
        zone: "main",
        quantity: 1,
        preferredPrintingId: printingIds["PMG-T05"]!,
      })
      .execute();
  });

  afterAll(async () => {
    await db.deleteFrom("deckCards").where("deckId", "=", deckId).execute();
    await db.deleteFrom("decks").where("id", "=", deckId).execute();
    await db.deleteFrom("listEntries").where("listId", "=", listId).execute();
    await db.deleteFrom("lists").where("id", "=", listId).execute();
    await db.deleteFrom("copies").where("collectionId", "=", collectionId).execute();
    await db.deleteFrom("collections").where("id", "=", collectionId).execute();
    await deletePrintingsByFace(db, "setId", "=", setId);
    await db.deleteFrom("cards").where("id", "in", Object.values(cardIds)).execute();
    await db.deleteFrom("sets").where("id", "=", setId).execute();
    await db.deleteFrom("users").where("id", "=", USER_ID).execute();
  });

  it("refuses an unknown printing slug", async () => {
    await expect(
      planPairMerge(db, { printings: [{ key: "x", sides: ["pmg-nope", slugs["PMG-T05"]!] }] }),
    ).rejects.toBeInstanceOf(PairMergeError);
  });

  it("defaults the home to the first printing and lists the owners that move there", async () => {
    const { homes: _homes, ...withoutHomes } = list();
    const report = await planPairMerge(db, withoutHomes);
    expect(report.sources.find((source) => source.slug === slugs["PMG-T01"])).toMatchObject({
      home: "bird-gold",
      defaultHome: true,
    });
    expect(report.owners).toEqual([
      expect.objectContaining({ slug: slugs["PMG-T01"], userId: USER_ID, copies: 2 }),
    ]);
  });

  it("plans the moves without writing", async () => {
    const report = await planPairMerge(db, list());
    expect(report.created).toHaveLength(2);
    expect(report.sources.find((source) => source.slug === slugs["PMG-T01"])).toMatchObject({
      home: "bird-gold",
      moved: { copies: 2, list_entries: 1 },
    });
    const stillThere = await db
      .selectFrom("printings")
      .select("id")
      .where("id", "in", Object.values(printingIds))
      .execute();
    expect(stillThere).toHaveLength(3);
  });

  it("creates the printings and moves everything to the homes", async () => {
    await applyPairMerge(db, list());

    const created = await db
      .selectFrom("printings as p")
      .innerJoin("faces as f1", "f1.id", "p.face1Id")
      .innerJoin("faces as f2", "f2.id", "p.face2Id")
      .select(["p.id", "f1.shortCode as code1", "f2.shortCode as code2"])
      .where("f1.setId", "=", setId)
      .execute();
    const byCodes = new Map(created.map((row) => [`${row.code1}+${row.code2}`, row.id]));
    const birdGold = byCodes.get("PMG-T01+PMG-T05");
    const birdBrush = byCodes.get("PMG-T01+PMG-T03");
    expect(birdGold).toBeDefined();
    expect(birdBrush).toBeDefined();

    const remaining = await db
      .selectFrom("printings")
      .select("id")
      .where("id", "in", Object.values(printingIds))
      .execute();
    expect(remaining).toEqual([]);

    const copyCounts = await db
      .selectFrom("copies")
      .select(["printingId", (eb) => eb.fn.countAll<number>().as("count")])
      .where("collectionId", "=", collectionId)
      .groupBy("printingId")
      .execute();
    expect(new Map(copyCounts.map((row) => [row.printingId, Number(row.count)]))).toEqual(
      new Map([
        [birdGold, 3],
        [birdBrush, 1],
      ]),
    );

    const entries = await db
      .selectFrom("listEntries")
      .select(["printingId", "quantity"])
      .where("listId", "=", listId)
      .execute();
    expect(entries).toEqual([{ printingId: birdGold, quantity: 3 }]);

    const deckCard = await db
      .selectFrom("deckCards")
      .select("preferredPrintingId")
      .where("deckId", "=", deckId)
      .executeTakeFirstOrThrow();
    expect(deckCard.preferredPrintingId).toBe(birdGold);
  });

  it("pairs an existing side with a side the list creates", async () => {
    const birdGold = await db
      .selectFrom("printings as p")
      .innerJoin("faces as f1", "f1.id", "p.face1Id")
      .select("p.slug")
      .where("f1.shortCode", "=", "PMG-T01")
      .executeTakeFirstOrThrow();
    const report = await applyPairMerge(db, {
      newFaces: {
        "gold-foil": {
          copyOf: { faceOf: birdGold.slug, code: "PMG-T05" },
          shortCode: "PMG-T09",
          publicCode: "PMG-T09",
          finish: "foil",
        },
      },
      printings: [
        {
          key: "gold-gold",
          sides: [{ faceOf: birdGold.slug, code: "PMG-T05" }, { newFace: "gold-foil" }],
        },
      ],
    });
    expect(report.newFaces).toEqual(["gold-foil"]);

    const created = await db
      .selectFrom("printings as p")
      .innerJoin("faces as f1", "f1.id", "p.face1Id")
      .innerJoin("faces as f2", "f2.id", "p.face2Id")
      .select(["f1.shortCode as code1", "f2.shortCode as code2", "f2.finish", "f2.cardId"])
      .where("f1.shortCode", "=", "PMG-T05")
      .executeTakeFirstOrThrow();
    expect(created).toEqual({
      code1: "PMG-T05",
      code2: "PMG-T09",
      finish: "foil",
      cardId: cardIds.Gold,
    });
  });
});
