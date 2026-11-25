import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDbContext,
  deletePrintingsByFace,
  insertCard,
  insertPrinting,
  refreshCardAggregates,
} from "../../../test/integration-context.js";
import { catalogCardsRepo } from "./catalog-cards.js";

const ctx = createDbContext("a0000000-0391-4000-a000-000000000001");

describe.skipIf(!ctx)("set legality ignores overnumbered faces (integration)", () => {
  const { db } = ctx!;
  const setIds: string[] = [];
  let cardId = "";

  beforeAll(async () => {
    for (const [slug, sortOrder] of [
      ["NUMSET-BASE", 991],
      ["NUMSET-PROMO", 992],
    ] as const) {
      const set = await db
        .insertInto("sets")
        .values({ slug, name: slug, sortOrder })
        .returning("id")
        .executeTakeFirstOrThrow();
      setIds.push(set.id);
    }
    const card = await insertCard(db, {
      slug: "numset-unit",
      name: "Numset Unit",
      normName: "numsetunit",
    });
    cardId = card.id;
    const face = (setId: string, shortCode: string, isOvernumbered: boolean) => ({
      cardId,
      setId,
      shortCode,
      publicCode: shortCode,
      rarity: "common" as const,
      artVariant: "normal" as const,
      isSigned: false,
      isOvernumbered,
      finish: "normal" as const,
      size: "standard",
      language: "EN",
      artist: "Test Artist",
    });
    await insertPrinting(db, face(setIds[0]!, "NUMSET-001", false));
    await insertPrinting(db, face(setIds[1]!, "NUMSET-300", true));
    await refreshCardAggregates(db);
  });

  afterAll(async () => {
    if (cardId) {
      await deletePrintingsByFace(db, "cardId", "=", cardId);
      await db.deleteFrom("cardCardTypes").where("cardId", "=", cardId).execute();
      await db.deleteFrom("cards").where("id", "=", cardId).execute();
    }
    if (setIds.length > 0) {
      await db.deleteFrom("sets").where("id", "in", setIds).execute();
    }
  });

  it("lists only the sets of in-numbering faces", async () => {
    const slugs = await catalogCardsRepo(db).numberedSetSlugsByCardIds([cardId]);
    expect(slugs.get(cardId)).toEqual(["NUMSET-BASE"]);
  });

  it("gives the catalog card the same sets", async () => {
    const [card] = await catalogCardsRepo(db).cardsByIds([cardId]);
    expect(card?.numberedSetSlugs).toEqual(["NUMSET-BASE"]);
  });
});
