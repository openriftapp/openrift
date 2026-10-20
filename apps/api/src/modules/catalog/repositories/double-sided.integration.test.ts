import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDbContext,
  deletePrintingsByFace,
  insertPrinting,
  refreshCardAggregates,
  seedTestUser,
} from "../../../test/integration-context.js";
import { candidateFingerprintsRepo } from "../../candidates/repositories/candidate-cards-fingerprints.js";
import { candidateMatchingRepo } from "../../candidates/repositories/candidate-cards-matching.js";
import { collectionEventsRepo } from "../../collections/repositories/collection-events.js";
import { collectionsRepo } from "../../collections/repositories/collections.js";
import { copiesRepo } from "../../collections/repositories/copies.js";
import { friendGroupsRepo } from "../../groups/repositories/friend-groups.js";
import { listEntriesRepo } from "../../lists/repositories/lists-entries.js";
import { marketplaceCollectionValueHistoryRepo } from "../../marketplace/repositories/marketplace-collection-value-history.js";
import { marketplacePricesRepo } from "../../marketplace/repositories/marketplace-prices.js";
import { catalogMutationsRepo } from "./catalog-mutations.js";
import { printingDeskRepo } from "./printing-desk.js";
import { printingEventsRepo } from "./printing-events.js";
import { printingImagesRepo } from "./printing-images.js";

// Uses the shared integration database. Requires INTEGRATION_DB_URL.
// Uses prefix DST- for entities it creates.

const USER_ID = crypto.randomUUID();
const ctx = createDbContext(USER_ID);

describe.skipIf(!ctx)("double-sided printings (integration)", () => {
  const { db } = ctx!;
  const mutations = catalogMutationsRepo(db);
  const copies = copiesRepo(db);
  const cardIds: Record<string, string> = {};
  const faceIds: Record<string, string> = {};
  let setId = "";
  let collectionId = "";

  function sideValues(card: string, shortCode: string) {
    return {
      cardId: cardIds[card]!,
      setId,
      shortCode,
      rarity: "common" as const,
      artVariant: "normal" as const,
      isSigned: false,
      isOvernumbered: false,
      markerSlugs: [],
      finish: "normal" as const,
      size: "standard" as const,
      artist: "DST Artist",
      publicCode: shortCode,
      printedRulesText: null,
      printedEffectText: null,
      flavorText: null,
      language: "EN",
      printedName: null,
      printedYear: null,
    };
  }

  beforeAll(async () => {
    await seedTestUser(db, { id: USER_ID });
    const [set] = await db
      .insertInto("sets")
      .values({ slug: "DST-TEST", name: "DST Test Set", printedTotal: 10, sortOrder: 941 })
      .returning("id")
      .execute();
    setId = set!.id;
    for (const name of ["Bird", "Gold", "Brush", "Buff"]) {
      const [card] = await db
        .insertInto("cards")
        .values({
          name,
          slug: `dst-${name.toLowerCase()}`,
          type: "other",
          normName: `dst-${name.toLowerCase()}`,
          keywords: [],
          tags: [],
        })
        .returning("id")
        .execute();
      cardIds[name] = card!.id;
    }
    for (const [card, code] of [
      ["Gold", "DST-T05"],
      ["Brush", "DST-T03"],
      ["Buff", "DST-T09"],
      ["Buff", "DST-T10"],
    ] as const) {
      const { faceId } = await insertPrinting(db, { ...sideValues(card, code), comment: null });
      faceIds[code] = faceId;
    }
    const collection = await collectionsRepo(db).create({
      userId: USER_ID,
      groupId: null,
      name: "DST binder",
      description: null,
      isInbox: false,
      sortOrder: 0,
    });
    collectionId = collection.id;
  });

  afterAll(async () => {
    const products = await db
      .selectFrom("marketplaceProducts")
      .select("id")
      .where("marketplace", "=", "cardtrader")
      .where("groupId", "=", 80_941)
      .execute();
    const productIds = products.map((product) => product.id);
    if (productIds.length > 0) {
      await db
        .deleteFrom("marketplaceProductVariants")
        .where("marketplaceProductId", "in", productIds)
        .execute();
      await db.deleteFrom("marketplaceProducts").where("id", "in", productIds).execute();
    }
    await db
      .deleteFrom("marketplaceGroups")
      .where("marketplace", "=", "cardtrader")
      .where("groupId", "=", 80_941)
      .execute();
    await sql`REFRESH MATERIALIZED VIEW mv_daily_printing_prices`.execute(db);
    await sql`REFRESH MATERIALIZED VIEW mv_latest_printing_prices`.execute(db);
    await db.deleteFrom("cardTrades").where("giverName", "=", "DST giver").execute();
    await db.deleteFrom("friendGroups").where("slug", "like", "dst-%").execute();
    await db.deleteFrom("collectionEvents").where("userId", "=", USER_ID).execute();
    await db.deleteFrom("candidateCards").where("provider", "=", "dst-test").execute();
    await db.deleteFrom("cardNameAliases").where("cardId", "in", Object.values(cardIds)).execute();
    await db.deleteFrom("lists").where("userId", "=", USER_ID).execute();
    await db.deleteFrom("deckCards").where("cardId", "in", Object.values(cardIds)).execute();
    await db.deleteFrom("decks").where("userId", "=", USER_ID).execute();
    await db.deleteFrom("copies").where("collectionId", "=", collectionId).execute();
    await db.deleteFrom("collections").where("id", "=", collectionId).execute();
    await db
      .deleteFrom("printingEvents")
      .where(
        "printingId",
        "in",
        db
          .selectFrom("printings")
          .innerJoin("faces", "faces.id", "printings.face1Id")
          .select("printings.id")
          .where("faces.setId", "=", setId),
      )
      .execute();
    await deletePrintingsByFace(db, "setId", "=", setId);
    await db.deleteFrom("imageFiles").where("originalUrl", "like", "https://dst.test/%").execute();
    await db.deleteFrom("cards").where("id", "in", Object.values(cardIds)).execute();
    await db.deleteFrom("sets").where("id", "=", setId).execute();
    await db.deleteFrom("users").where("id", "=", USER_ID).execute();
  });

  it("shares the Bird face between T01+T05 and T01+T03", async () => {
    const withGold = await mutations.upsertPrinting(
      sideValues("Bird", "DST-T01"),
      faceIds["DST-T05"]!,
    );
    const withBrush = await mutations.upsertPrinting(
      sideValues("Bird", "DST-T01"),
      faceIds["DST-T03"]!,
    );

    const printings = await db
      .selectFrom("printings")
      .select(["id", "face1Id", "face2Id"])
      .where("id", "in", [withGold, withBrush])
      .execute();
    const birdFace = await mutations.findFaceIdByIdentity({
      cardId: cardIds.Bird!,
      shortCode: "DST-T01",
      finish: "normal",
      markerSlugs: [],
      language: "EN",
    });
    expect(printings).toHaveLength(2);
    expect(new Set(printings.flatMap((p) => [p.face1Id, p.face2Id])).size).toBe(3);
    expect(printings.every((p) => p.face1Id === birdFace?.id || p.face2Id === birdFace?.id)).toBe(
      true,
    );
  });

  it("finds the pair again whichever side is named first", async () => {
    const first = await mutations.upsertPrinting(
      sideValues("Bird", "DST-T01"),
      faceIds["DST-T05"]!,
    );
    const birdFace = await mutations.findFaceIdByIdentity({
      cardId: cardIds.Bird!,
      shortCode: "DST-T01",
      finish: "normal",
      markerSlugs: [],
      language: "EN",
    });
    const reversed = await mutations.upsertPrinting(sideValues("Gold", "DST-T05"), birdFace!.id);
    expect(reversed).toBe(first);
  });

  it("counts owned copies for the card on each side, once for a card on both", async () => {
    const withGold = await mutations.upsertPrinting(
      sideValues("Bird", "DST-T01"),
      faceIds["DST-T05"]!,
    );
    const withBrush = await mutations.upsertPrinting(
      sideValues("Bird", "DST-T01"),
      faceIds["DST-T03"]!,
    );
    const buffBuff = await mutations.upsertPrinting(
      sideValues("Buff", "DST-T09"),
      faceIds["DST-T10"]!,
    );
    await copies.insertBatch([
      { printingId: withGold, collectionId },
      { printingId: withBrush, collectionId },
      { printingId: buffBuff, collectionId },
    ]);

    const counts = await copies.buildableCountByCard(USER_ID);
    expect(counts.get(cardIds.Bird!)).toBe(2);
    expect(counts.get(cardIds.Gold!)).toBe(1);
    expect(counts.get(cardIds.Brush!)).toBe(1);
    expect(counts.get(cardIds.Buff!)).toBe(1);
  });

  it("removing the side stored first keeps the other, folds its deck slots and deletes it", async () => {
    const { faceId: brushFace } = await insertPrinting(db, {
      ...sideValues("Brush", "DST-T13"),
      comment: null,
    });
    const single = await db
      .selectFrom("printings")
      .select("id")
      .where("face1Id", "=", brushFace)
      .executeTakeFirstOrThrow();
    await db.deleteFrom("printings").where("id", "=", single.id).execute();
    const pair = await mutations.upsertPrinting(sideValues("Gold", "DST-T15"), brushFace);
    const [deck] = await db
      .insertInto("decks")
      .values({ userId: USER_ID, name: "DST deck", format: "constructed" } as never)
      .returning("id")
      .execute();
    await db
      .insertInto("deckCards")
      .values([
        {
          deckId: deck!.id,
          cardId: cardIds.Brush!,
          zone: "main",
          quantity: 1,
          preferredPrintingId: pair,
        },
        {
          deckId: deck!.id,
          cardId: cardIds.Brush!,
          zone: "main",
          quantity: 2,
          preferredPrintingId: null,
        },
      ])
      .execute();

    await printingDeskRepo(db).dropFace(pair, brushFace);

    const kept = await db
      .selectFrom("printings as p")
      .innerJoin("faces as f", "f.id", "p.face1Id")
      .select(["f.shortCode", "p.face2Id"])
      .where("p.id", "=", pair)
      .executeTakeFirstOrThrow();
    expect(kept).toEqual({ shortCode: "DST-T15", face2Id: null });
    const slots = await db
      .selectFrom("deckCards")
      .select(["preferredPrintingId", "quantity"])
      .where("deckId", "=", deck!.id)
      .execute();
    expect(slots).toEqual([{ preferredPrintingId: null, quantity: 3 }]);
    const orphan = await db
      .selectFrom("faces")
      .select("id")
      .where("id", "=", brushFace)
      .executeTakeFirst();
    expect(orphan).toBeUndefined();
  });

  async function freshPair(first: [string, string], second: [string, string]) {
    const { faceId } = await insertPrinting(db, {
      ...sideValues(first[0], first[1]),
      comment: null,
    });
    await db.deleteFrom("printings").where("face1Id", "=", faceId).execute();
    const printingId = await mutations.upsertPrinting(sideValues(second[0], second[1]), faceId);
    return { printingId, firstFace: faceId };
  }

  async function deckWith(slots: { cardId: string; preferredPrintingId: string | null }[]) {
    const [deck] = await db
      .insertInto("decks")
      .values({ userId: USER_ID, name: "DST deck", format: "constructed" } as never)
      .returning("id")
      .execute();
    await db
      .insertInto("deckCards")
      .values(slots.map((slot) => ({ deckId: deck!.id, zone: "main", quantity: 1, ...slot })))
      .execute();
    return deck!.id;
  }

  it("removing a side clears a deck slot's preference when no plain slot exists", async () => {
    const { printingId, firstFace } = await freshPair(["Brush", "DST-T21"], ["Gold", "DST-T22"]);
    const deckId = await deckWith([{ cardId: cardIds.Brush!, preferredPrintingId: printingId }]);

    await printingDeskRepo(db).dropFace(printingId, firstFace);

    const slots = await db
      .selectFrom("deckCards")
      .select(["preferredPrintingId", "quantity"])
      .where("deckId", "=", deckId)
      .execute();
    expect(slots).toEqual([{ preferredPrintingId: null, quantity: 1 }]);
  });

  it("deleting a printing folds its deck slots into an existing plain slot", async () => {
    const { printingId } = await freshPair(["Brush", "DST-T23"], ["Gold", "DST-T24"]);
    const deckId = await deckWith([
      { cardId: cardIds.Gold!, preferredPrintingId: printingId },
      { cardId: cardIds.Gold!, preferredPrintingId: null },
    ]);

    await db.deleteFrom("printings").where("id", "=", printingId).execute();

    const slots = await db
      .selectFrom("deckCards")
      .select(["preferredPrintingId", "quantity"])
      .where("deckId", "=", deckId)
      .execute();
    expect(slots).toEqual([{ preferredPrintingId: null, quantity: 2 }]);
  });

  it("deleting two printings in one statement folds their slots for the same card", async () => {
    const first = await freshPair(["Brush", "DST-T31"], ["Gold", "DST-T32"]);
    const second = await freshPair(["Brush", "DST-T33"], ["Gold", "DST-T34"]);
    const deckId = await deckWith([
      { cardId: cardIds.Gold!, preferredPrintingId: first.printingId },
      { cardId: cardIds.Gold!, preferredPrintingId: second.printingId },
    ]);

    await db
      .deleteFrom("printings")
      .where("id", "in", [first.printingId, second.printingId])
      .execute();

    const slots = await db
      .selectFrom("deckCards")
      .select(["preferredPrintingId", "quantity"])
      .where("deckId", "=", deckId)
      .execute();
    expect(slots).toEqual([{ preferredPrintingId: null, quantity: 2 }]);
  });

  it("re-sorts the sides when a side's short code changes", async () => {
    const { printingId, firstFace } = await freshPair(["Brush", "DST-T41"], ["Gold", "DST-T42"]);
    const goldFace = await db
      .selectFrom("printings")
      .select("face2Id")
      .where("id", "=", printingId)
      .executeTakeFirstOrThrow();

    await db
      .updateTable("faces")
      .set({ shortCode: "DST-T40" })
      .where("id", "=", goldFace.face2Id!)
      .execute();

    const after = await db
      .selectFrom("printings")
      .select(["face1Id", "face2Id"])
      .where("id", "=", printingId)
      .executeTakeFirstOrThrow();
    expect(after).toEqual({ face1Id: goldFace.face2Id, face2Id: firstFace });
  });

  it("presents a card printed only as a second side by that side on the desk", async () => {
    const { printingId } = await freshPair(["Brush", "DST-T25"], ["Gold", "DST-T26"]);
    const desk = printingDeskRepo(db);

    const rows = await desk.listDeskPrintingsForCard(cardIds.Gold!);
    const row = rows.find((candidate) => candidate.printingId === printingId);
    expect(row).toMatchObject({ side: 2, cardId: cardIds.Gold, shortCode: "DST-T26" });
    expect(row?.secondSide?.shortCode).toBe("DST-T25");

    const full = await desk.getFullPrintingForCard(printingId, cardIds.Gold!);
    expect(full).toMatchObject({ cardId: cardIds.Gold, shortCode: "DST-T26" });
  });

  it("leaves a reused side's printed fields alone when a new printing shows it", async () => {
    const { faceId } = await insertPrinting(db, {
      ...sideValues("Brush", "DST-T27"),
      comment: null,
    });
    await db.updateTable("faces").set({ printedYear: 2025 }).where("id", "=", faceId).execute();

    await mutations.upsertPrinting({ ...sideValues("Brush", "DST-T27"), size: "oversized" });

    const face = await db
      .selectFrom("faces")
      .select(["printedYear", "artist"])
      .where("id", "=", faceId)
      .executeTakeFirstOrThrow();
    expect(face).toEqual({ printedYear: 2025, artist: "DST Artist" });
    const printings = await db
      .selectFrom("printings")
      .select("size")
      .where("face1Id", "=", faceId)
      .orderBy("size")
      .execute();
    expect(printings.map((row) => row.size)).toEqual(["oversized", "standard"]);
  });

  it("names a trade by the card the receiver's wish asked for, else by side 1", async () => {
    const { printingId } = await freshPair(["Brush", "DST-T61"], ["Gold", "DST-T62"]);
    const list = await db
      .insertInto("lists")
      .values({ userId: USER_ID, name: "DST wants", intent: "wish", kind: "card" })
      .returning("id")
      .executeTakeFirstOrThrow();
    const entry = await db
      .insertInto("listEntries")
      .values({
        listId: list.id,
        userId: USER_ID,
        kind: "card",
        cardId: cardIds.Gold!,
        quantity: 1,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const trade = (values: { receiverWishEntryId?: string; cardId?: string }) =>
      db
        .insertInto("cardTrades")
        .values({
          groupName: "DST group",
          giverName: "DST giver",
          receiverName: "DST receiver",
          initiator: "receiver",
          printingId,
          quantity: 1,
          expiresAt: new Date(Date.now() + 60_000),
          ...values,
        })
        .returning("cardId")
        .executeTakeFirstOrThrow();

    await expect(trade({ receiverWishEntryId: entry.id })).resolves.toEqual({
      cardId: cardIds.Gold,
    });
    await expect(trade({})).resolves.toEqual({ cardId: cardIds.Brush });
    await expect(trade({ cardId: cardIds.Gold })).resolves.toEqual({ cardId: cardIds.Gold });
    await expect(trade({ cardId: cardIds.Buff })).rejects.toThrow();
  });

  it("compares a candidate against the side whose card it names", async () => {
    const { printingId } = await freshPair(["Brush", "DST-T63"], ["Gold", "DST-T64"]);
    const printing = await db
      .selectFrom("printings")
      .select(["face1Id", "face2Id"])
      .where("id", "=", printingId)
      .executeTakeFirstOrThrow();
    for (const [faceId, name] of [
      [printing.face1Id, "brush"],
      [printing.face2Id!, "gold"],
    ] as const) {
      const file = await db
        .insertInto("imageFiles")
        .values({ originalUrl: `https://dst.test/${name}.png`, fingerprint: `fp-${name}` })
        .returning("id")
        .executeTakeFirstOrThrow();
      await db
        .insertInto("faceImages")
        .values({ faceId, imageFileId: file.id, isActive: true })
        .execute();
    }
    await db
      .insertInto("cardNameAliases")
      .values({ cardId: cardIds.Gold!, normName: "dstgold" })
      .execute();
    const candidateCard = await db
      .insertInto("candidateCards")
      .values({
        provider: "dst-test",
        externalId: "dst-gold",
        name: "DST Gold",
        domains: [],
        normName: "dstgold",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const candidate = await db
      .insertInto("candidatePrintings")
      .values({
        candidateCardId: candidateCard.id,
        shortCode: "DST-T64",
        externalId: "dst-gold-p",
        printingId,
        imageUrl: "https://dst.test/candidate.png",
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    await expect(printingImagesRepo(db).candidateFace(candidate.id)).resolves.toBe("back");
    const toFingerprint =
      await candidateFingerprintsRepo(db).listPrintingsNeedingFingerprint(100_000);
    expect(toFingerprint.find((row) => row.id === candidate.id)?.liveFingerprint).toBe("fp-gold");
    const unchecked = await candidateMatchingRepo(db).listUncheckedCandidatePrintingsWithLive(
      "none",
      null,
      100_000,
    );
    const live = unchecked.find((row) => row.id === candidate.id)?.live;
    expect(live?.shortCode).toBe("DST-T64");
    expect(live?.imageFingerprints).toEqual(["fp-gold"]);
  });

  it("names a double-sided printing by both cards in announcements and history", async () => {
    const { printingId } = await freshPair(["Brush", "DST-T65"], ["Gold", "DST-T66"]);
    await printingEventsRepo(db).recordNew(printingId);
    await db
      .insertInto("collectionEvents")
      .values({ userId: USER_ID, action: "added", printingId, toCollectionName: "DST binder" })
      .execute();

    const pending = await printingEventsRepo(db).listPending();
    expect(pending.find((event) => event.printingId === printingId)?.cardName).toBe(
      "Brush // Gold",
    );
    await refreshCardAggregates(db);
    const history = await collectionEventsRepo(db).listForUser(USER_ID, 10);
    expect(history.find((event) => event.printingId === printingId)?.cardName).toBe(
      "Brush // Gold",
    );
  });

  it("captions a post image from the side that holds it", async () => {
    const { printingId } = await freshPair(["Brush", "DST-T67"], ["Gold", "DST-T68"]);
    const printing = await db
      .selectFrom("printings")
      .select(["face1Id", "face2Id"])
      .where("id", "=", printingId)
      .executeTakeFirstOrThrow();
    const goldFile = await db
      .insertInto("imageFiles")
      .values({ originalUrl: "https://dst.test/post-gold.png" })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("faceImages")
      .values({ faceId: printing.face2Id!, imageFileId: goldFile.id, isActive: true })
      .execute();
    const desk = printingDeskRepo(db);

    await expect(desk.getPostImageRow(printingId, goldFile.id)).resolves.toMatchObject({
      cardName: "Gold",
    });
    await expect(desk.getPostImageRow(printingId)).resolves.toMatchObject({ cardName: "Brush" });
  });

  it("copies a candidate's differentiators from the side with its short code", async () => {
    const { printingId } = await freshPair(["Brush", "DST-T69"], ["Gold", "DST-T70"]);
    await db
      .updateTable("faces")
      .set({ rarity: "rare" })
      .where("shortCode", "=", "DST-T70")
      .execute();

    await expect(
      mutations.getPrintingDifferentiatorsById(printingId, "DST-T70"),
    ).resolves.toMatchObject({ rarity: "rare" });
    await expect(mutations.getPrintingDifferentiatorsById(printingId)).resolves.toMatchObject({
      rarity: "common",
    });
  });

  it("finds the receiver's wish for a pair's other card in the trade's group", async () => {
    const { printingId } = await freshPair(["Brush", "DST-T71"], ["Gold", "DST-T72"]);
    const groups = friendGroupsRepo(db);
    const group = await groups.createWithOwner(
      { slug: `dst-${Date.now().toString(36)}`, name: "DST group", description: null, code: null },
      USER_ID,
    );
    const list = await db
      .insertInto("lists")
      .values({ userId: USER_ID, name: "DST shared wants", intent: "wish", kind: "card" })
      .returning("id")
      .executeTakeFirstOrThrow();
    const wish = (cardId: string, quantity: number) =>
      db
        .insertInto("listEntries")
        .values({ listId: list.id, userId: USER_ID, kind: "card", cardId, quantity })
        .returning("id")
        .executeTakeFirstOrThrow();
    const brush = await wish(cardIds.Brush!, 1);
    const gold = await wish(cardIds.Gold!, 2);
    await groups.share(group.id, list.id, USER_ID);
    const unshared = await db
      .insertInto("lists")
      .values({ userId: USER_ID, name: "DST private wants", intent: "wish", kind: "card" })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("listEntries")
      .values({
        listId: unshared.id,
        userId: USER_ID,
        kind: "card",
        cardId: cardIds.Gold!,
        quantity: 1,
      })
      .execute();
    const otherGroup = await groups.createWithOwner(
      {
        slug: `dst-o-${Date.now().toString(36)}`,
        name: "DST other",
        description: null,
        code: null,
      },
      USER_ID,
    );
    await groups.share(otherGroup.id, unshared.id, USER_ID);
    const printingList = await db
      .insertInto("lists")
      .values({ userId: USER_ID, name: "DST printing wants", intent: "wish", kind: "printing" })
      .returning("id")
      .executeTakeFirstOrThrow();
    const printingWish = await db
      .insertInto("listEntries")
      .values({
        listId: printingList.id,
        userId: USER_ID,
        kind: "printing",
        printingId,
        quantity: 1,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const repo = listEntriesRepo(db);
    const othersFor = (entryId: string) =>
      repo.otherCardWishesForPrinting({ userId: USER_ID, groupId: group.id, printingId, entryId });

    await expect(othersFor(brush.id)).resolves.toEqual([
      { id: gold.id, cardId: cardIds.Gold, quantity: 2 },
    ]);
    await expect(othersFor(printingWish.id)).resolves.toEqual([]);
    await expect(
      repo.otherCardWishesForPrinting({
        userId: "someone-else",
        groupId: group.id,
        printingId,
        entryId: brush.id,
      }),
    ).resolves.toEqual([]);
  });

  it("tells the sides of a same-card pair apart by the candidate's short code", async () => {
    const { printingId } = await freshPair(["Buff", "DST-T73"], ["Buff", "DST-T74"]);
    await db
      .insertInto("cardNameAliases")
      .values({ cardId: cardIds.Buff!, normName: "dstbuff" })
      .execute();
    const candidateCard = await db
      .insertInto("candidateCards")
      .values({
        provider: "dst-test",
        externalId: "dst-buff",
        name: "DST Buff",
        domains: [],
        normName: "dstbuff",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const candidate = await db
      .insertInto("candidatePrintings")
      .values({
        candidateCardId: candidateCard.id,
        shortCode: "dst-t74",
        externalId: "dst-buff-p",
        printingId,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    await expect(printingImagesRepo(db).candidateFace(candidate.id)).resolves.toBe("back");
  });

  it("prices a double-sided printing once per deck and scopes its value by either side", async () => {
    const { printingId } = await freshPair(["Brush", "DST-T77"], ["Gold", "DST-T78"]);
    await db
      .insertInto("marketplaceGroups")
      .values({ marketplace: "cardtrader", groupId: 80_941, name: "DST group", abbreviation: null })
      .onConflict((oc) => oc.columns(["marketplace", "groupId"]).doNothing())
      .execute();
    const product = await db
      .insertInto("marketplaceProducts")
      .values({
        marketplace: "cardtrader",
        groupId: 80_941,
        externalId: 913_941,
        productName: "DST Brush // Gold",
        finish: "normal",
        language: null,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("marketplaceProductVariants")
      .values({ marketplaceProductId: product.id, printingId })
      .execute();
    await db
      .insertInto("marketplaceProductPrices")
      .values({
        marketplaceProductId: product.id,
        marketCents: 100,
        lowCents: 100,
        recordedAt: new Date("2026-01-01T00:00:00Z"),
      })
      .execute();
    await sql`REFRESH MATERIALIZED VIEW mv_daily_printing_prices`.execute(db);
    await sql`REFRESH MATERIALIZED VIEW mv_latest_printing_prices`.execute(db);

    const [deck] = await db
      .insertInto("decks")
      .values({ userId: USER_ID, name: "DST priced deck", format: "constructed" } as never)
      .returning("id")
      .execute();
    await db
      .insertInto("deckCards")
      .values([
        { deckId: deck!.id, cardId: cardIds.Brush!, zone: "main", quantity: 1 },
        { deckId: deck!.id, cardId: cardIds.Gold!, zone: "main", quantity: 2 },
      ])
      .execute();
    const values = await marketplacePricesRepo(db).deckValues(USER_ID, "cardtrader", []);
    expect(values.get(deck!.id)).toBe(200);

    await db
      .updateTable("cards")
      .set({ keywords: ["dst-shiny"] })
      .where("id", "=", cardIds.Gold!)
      .execute();
    await db.insertInto("copies").values({ printingId, collectionId }).execute();
    const history = marketplaceCollectionValueHistoryRepo(db);
    const series = (keywords: string[]) =>
      history.collectionValueTimeSeries({
        userId: USER_ID,
        marketplace: "cardtrader",
        collectionIds: [collectionId],
        cutoff: null,
        scope: { keywords },
      });
    const scoped = await series(["dst-shiny"]);
    const unscoped = await series(["dst-nothing"]);
    expect(scoped.at(-1)?.valueCents).toBe(100);
    expect(unscoped.at(-1)?.valueCents ?? 0).toBe(0);
  });

  it("refuses the same face on both sides", async () => {
    await expect(
      db
        .insertInto("printings")
        .values({ face1Id: faceIds["DST-T05"]!, face2Id: faceIds["DST-T05"]!, size: "standard" })
        .execute(),
    ).rejects.toThrow();
  });
});
