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
const GIVER_ID = crypto.randomUUID();
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
  let productId = "";
  let channelId = "";

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
    await seedTestUser(db, { id: GIVER_ID });
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
    await db.deleteFrom("overlayChannels").where("userId", "=", USER_ID).execute();
    await db
      .deleteFrom("printingDistributionChannels")
      .where("channelId", "=", channelId)
      .execute();
    await db.deleteFrom("distributionChannels").where("id", "=", channelId).execute();
    await db.deleteFrom("productPrintings").where("productId", "=", productId).execute();
    await db.deleteFrom("products").where("id", "=", productId).execute();
    await db.deleteFrom("cardmarketSyncState").where("userId", "=", USER_ID).execute();
    await db.deleteFrom("cardTrades").where("receiverUserId", "=", USER_ID).execute();
    await db.deleteFrom("printingLinkOverrides").where("externalId", "=", "pmg-override").execute();
    await db.deleteFrom("deckCards").where("deckId", "=", deckId).execute();
    await db.deleteFrom("decks").where("id", "=", deckId).execute();
    await db.deleteFrom("listEntries").where("listId", "=", listId).execute();
    await db.deleteFrom("lists").where("id", "=", listId).execute();
    await db.deleteFrom("copies").where("collectionId", "=", collectionId).execute();
    await db.deleteFrom("collections").where("id", "=", collectionId).execute();
    await deletePrintingsByFace(db, "setId", "=", setId);
    await db.deleteFrom("cards").where("id", "in", Object.values(cardIds)).execute();
    await db.deleteFrom("sets").where("id", "=", setId).execute();
    await db.deleteFrom("users").where("id", "in", [USER_ID, GIVER_ID]).execute();
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

  function liveTrade(printingId: string, wishEntryId: string | null) {
    return {
      groupName: "PMG group",
      giverUserId: GIVER_ID,
      receiverUserId: USER_ID,
      initiator: "receiver",
      printingId,
      quantity: 1,
      status: "pending",
      receiverWishEntryId: wishEntryId,
      expiresAt: new Date(Date.now() + 86_400_000),
    };
  }

  it("refuses while one pair of users has live trades for two sides that share a home", async () => {
    const goldEntry = await db
      .selectFrom("listEntries")
      .select("id")
      .where("listId", "=", listId)
      .where("printingId", "=", printingIds["PMG-T05"]!)
      .executeTakeFirstOrThrow();
    const [birdTrade] = await db
      .insertInto("cardTrades")
      .values([
        liveTrade(printingIds["PMG-T01"]!, null),
        liveTrade(printingIds["PMG-T05"]!, goldEntry.id),
      ] as never)
      .returning("id")
      .execute();
    await expect(planPairMerge(db, list())).rejects.toBeInstanceOf(PairMergeError);
    await db.deleteFrom("cardTrades").where("id", "=", birdTrade!.id).execute();
  });

  it("creates the printings and moves everything to the homes", async () => {
    const [channel] = await db
      .insertInto("distributionChannels")
      .values({ slug: "pmg-skirmish", label: "PMG Summoner Skirmish" })
      .returning("id")
      .execute();
    channelId = channel!.id;
    await db
      .insertInto("printingDistributionChannels")
      .values([
        { printingId: printingIds["PMG-T01"]!, channelId },
        { printingId: printingIds["PMG-T05"]!, channelId },
      ])
      .execute();
    await db
      .insertInto("printingCitations")
      .values([
        {
          printingId: printingIds["PMG-T01"]!,
          label: "PMG source",
          sourceUrl: "https://example.com/pmg",
        },
        {
          printingId: printingIds["PMG-T05"]!,
          label: "PMG source",
          sourceUrl: "https://example.com/pmg",
        },
      ])
      .execute();
    await db
      .insertInto("printingEvents")
      .values([{ printingId: printingIds["PMG-T05"]! }, { printingId: printingIds["PMG-T01"]! }])
      .execute();
    const [product] = await db
      .insertInto("products")
      .values({ slug: "pmg-bundle", name: "PMG bundle" })
      .returning("id")
      .execute();
    productId = product!.id;
    await db
      .insertInto("productPrintings")
      .values([
        { productId, printingId: printingIds["PMG-T01"]!, quantity: 1 },
        { productId, printingId: printingIds["PMG-T05"]!, quantity: 1 },
      ])
      .execute();
    await db
      .insertInto("cardmarketSyncState")
      .values(
        ["PMG-T01", "PMG-T05"].map((code) => ({
          userId: USER_ID,
          printingId: printingIds[code]!,
          condition: "near-mint",
          isAltered: false,
          intentBase: 2,
          observedBase: 1,
          unmanaged: 0,
        })),
      )
      .execute();
    await db
      .insertInto("overlayChannels")
      .values({
        userId: USER_ID,
        payload: {
          printingId: printingIds["PMG-T05"]!,
          queue: [printingIds["PMG-T01"]!],
          board: { tiers: [{ cards: [{ printingId: printingIds["PMG-T05"]! }] }] },
        },
      } as never)
      .execute();
    await db
      .updateTable("lists")
      .set({ rules: [{ excludeIds: [printingIds["PMG-T05"]!] }] } as never)
      .where("id", "=", listId)
      .execute();
    await db
      .insertInto("printingLinkOverrides")
      .values({
        externalId: "pmg-override",
        finish: "normal",
        provider: "tcgplayer",
        printingId: printingIds["PMG-T05"]!,
      })
      .execute();
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

    const survivingEntry = await db
      .selectFrom("listEntries")
      .select("id")
      .where("listId", "=", listId)
      .executeTakeFirstOrThrow();
    const trade = await db
      .selectFrom("cardTrades")
      .select(["printingId", "receiverWishEntryId"])
      .where("receiverUserId", "=", USER_ID)
      .executeTakeFirstOrThrow();
    expect(trade).toEqual({ printingId: birdGold, receiverWishEntryId: survivingEntry.id });

    const override = await db
      .selectFrom("printingLinkOverrides")
      .select("printingId")
      .where("externalId", "=", "pmg-override")
      .executeTakeFirstOrThrow();
    expect(override.printingId).toBe(birdGold);

    const channels = await db
      .selectFrom("printingDistributionChannels")
      .select("printingId")
      .where("channelId", "=", channelId)
      .execute();
    expect(channels).toEqual([{ printingId: birdGold }]);
    const citations = await db
      .selectFrom("printingCitations")
      .select("printingId")
      .where("sourceUrl", "=", "https://example.com/pmg")
      .execute();
    expect(citations).toEqual([{ printingId: birdGold }]);
    const events = await db
      .selectFrom("printingEvents")
      .select("printingId")
      .where("printingId", "=", birdGold!)
      .execute();
    expect(events).toHaveLength(1);
    await db.deleteFrom("printingEvents").where("printingId", "=", birdGold!).execute();

    const rules = await db
      .selectFrom("lists")
      .select("rules")
      .where("id", "=", listId)
      .executeTakeFirstOrThrow();
    expect(rules.rules).toEqual([{ excludeIds: [birdGold] }]);

    const overlay = await db
      .selectFrom("overlayChannels")
      .select("payload")
      .where("userId", "=", USER_ID)
      .executeTakeFirstOrThrow();
    expect(overlay.payload).toEqual({
      printingId: `${birdGold}:2`,
      queue: [birdGold],
      board: { tiers: [{ cards: [{ printingId: birdGold }] }] },
    });

    const contents = await db
      .selectFrom("productPrintings")
      .select(["printingId", "quantity"])
      .where("productId", "=", productId)
      .execute();
    expect(contents).toEqual([{ printingId: birdGold, quantity: 1 }]);

    const sync = await db
      .selectFrom("cardmarketSyncState")
      .select(["printingId", "intentBase", "observedBase"])
      .where("userId", "=", USER_ID)
      .execute();
    expect(sync).toEqual([{ printingId: birdGold, intentBase: 4, observedBase: 2 }]);

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
