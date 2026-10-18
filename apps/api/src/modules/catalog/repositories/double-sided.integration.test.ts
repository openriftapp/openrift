import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDbContext,
  deletePrintingsByFace,
  insertPrinting,
  seedTestUser,
} from "../../../test/integration-context.js";
import { collectionsRepo } from "../../collections/repositories/collections.js";
import { copiesRepo } from "../../collections/repositories/copies.js";
import { catalogMutationsRepo } from "./catalog-mutations.js";

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
    await db.deleteFrom("copies").where("collectionId", "=", collectionId).execute();
    await db.deleteFrom("collections").where("id", "=", collectionId).execute();
    await deletePrintingsByFace(db, "setId", "=", setId);
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

  it("refuses the same face on both sides", async () => {
    await expect(
      db
        .insertInto("printings")
        .values({ face1Id: faceIds["DST-T05"]!, face2Id: faceIds["DST-T05"]!, size: "standard" })
        .execute(),
    ).rejects.toThrow();
  });
});
