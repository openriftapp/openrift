import { afterAll, describe, expect, it } from "vitest";

import {
  adminReq,
  createTestContext,
  deletePrintingsById,
  insertCard,
  insertImageFile,
  insertPrinting,
  refreshCardAggregates,
  seedTestUser,
} from "../../../test/integration-context.js";
import { readJson } from "../../../test/read-json.js";

const ADMIN_ID = "a0000000-0531-4000-a000-000000000001";
const REVIEW_ID = "a0000000-0532-4000-a000-000000000001";
const DESK_ID = "a0000000-0533-4000-a000-000000000001";
const PLAIN_ID = "a0000000-0534-4000-a000-000000000001";

const ALLOWED = "wsq-allowed";
const DENIED = "wsq-denied";

const adminCtx = createTestContext(ADMIN_ID);
const reviewCtx = createTestContext(REVIEW_ID);
const deskCtx = createTestContext(DESK_ID);
const plainCtx = createTestContext(PLAIN_ID);

let setId = "";
let cardId = "";
let basePrintingId = "";
let baseFaceId = "";
let promoPrintingId = "";
let promoFaceId = "";
let imageId = "";
let imageFileId = "";
let newCandidatePrintingId = "";
const candidateCardIds: string[] = [];

if (adminCtx) {
  const { db } = adminCtx;

  for (const id of [ADMIN_ID, REVIEW_ID, DESK_ID, PLAIN_ID]) {
    await seedTestUser(db, { id });
  }
  await db
    .insertInto("admins")
    .values({ userId: ADMIN_ID })
    .onConflict((oc) => oc.column("userId").doNothing())
    .execute();
  await db
    .insertInto("adminGrants")
    .values([
      { userId: REVIEW_ID, section: "card-review" },
      { userId: DESK_ID, section: "printing-desk" },
    ])
    .execute();
  await db
    .insertInto("providerSettings")
    .values([
      {
        provider: ALLOWED,
        isHelperReviewable: true,
        isFavorite: false,
        isHidden: false,
        sortOrder: 0,
      },
      {
        provider: DENIED,
        isHelperReviewable: false,
        isFavorite: false,
        isHidden: false,
        sortOrder: 0,
      },
    ])
    .onConflict((oc) => oc.column("provider").doNothing())
    .execute();
  await db
    .insertInto("markers")
    .values({ slug: "wsq-promo", label: "WSQ Promo", sortOrder: 953 })
    .onConflict((oc) => oc.column("slug").doNothing())
    .execute();

  const set = await db
    .insertInto("sets")
    .values({ slug: "WSQ", name: "WSQ Test Set", printedTotal: 50, sortOrder: 953 })
    .returning("id")
    .executeTakeFirstOrThrow();
  setId = set.id;

  const card = await insertCard(db, {
    slug: "wsq-poro-keeper",
    name: "WSQ Poro Keeper",
    types: ["unit"],
    might: 2,
    energy: 2,
    power: 1,
    mightBonus: null,
    keywords: [],
    tags: [],
  });
  cardId = card.id;

  const face = {
    cardId,
    setId,
    rarity: "common",
    artVariant: "normal",
    isSigned: false,
    finish: "normal",
    artist: "WSQ Artist",
    printedRulesText: null,
    printedEffectText: null,
    flavorText: null,
    language: "EN",
  };
  const base = await insertPrinting(db, {
    ...face,
    shortCode: "WSQ-001",
    publicCode: "WSQ-001/50",
  });
  basePrintingId = base.id;
  baseFaceId = base.faceId;
  const promo = await insertPrinting(db, {
    ...face,
    shortCode: "WSQ-002",
    publicCode: "WSQ-002/50",
    markerSlugs: ["wsq-promo"],
  });
  promoPrintingId = promo.id;
  promoFaceId = promo.faceId;

  const file = await insertImageFile(db);
  imageFileId = file.id;
  const image = await db
    .insertInto("faceImages")
    .values({ faceId: promoFaceId, imageFileId, isActive: false })
    .returning("id")
    .executeTakeFirstOrThrow();
  imageId = image.id;

  const candidateCard = (provider: string, name: string, externalId: string, energy = 2) => ({
    provider,
    name,
    types: ["unit"],
    superTypes: [],
    domains: [],
    might: 2,
    energy,
    power: 1,
    mightBonus: null,
    rulesText: null,
    effectText: null,
    tags: [],
    shortCode: null,
    externalId,
    extraData: null,
  });
  const candidatePrinting = (
    candidateCardId: string,
    externalId: string,
    over: Record<string, unknown>,
  ) => ({
    candidateCardId,
    shortCode: "WSQ-001",
    setId: "WSQ",
    setName: "WSQ Test Set",
    rarity: "common",
    artVariant: "normal",
    isSigned: false,
    finish: "normal",
    artist: "WSQ Artist",
    publicCode: null,
    printedRulesText: null,
    printedEffectText: null,
    flavorText: null,
    imageUrl: null,
    language: "EN",
    externalId,
    extraData: null,
    ...over,
  });

  const allowedCard = await db
    .insertInto("candidateCards")
    .values(candidateCard(ALLOWED, "WSQ Poro Keeper", "wsq-cc-allowed", 3))
    .returning("id")
    .executeTakeFirstOrThrow();
  const deniedCard = await db
    .insertInto("candidateCards")
    .values(candidateCard(DENIED, "WSQ Poro Keeper", "wsq-cc-denied"))
    .returning("id")
    .executeTakeFirstOrThrow();
  const draftCard = await db
    .insertInto("candidateCards")
    .values(candidateCard(ALLOWED, "WSQ Brand New Card", "wsq-cc-draft"))
    .returning("id")
    .executeTakeFirstOrThrow();
  candidateCardIds.push(allowedCard.id, deniedCard.id, draftCard.id);

  await db
    .insertInto("candidatePrintings")
    .values([
      candidatePrinting(allowedCard.id, "wsq-cp-base", {
        printingId: basePrintingId,
        artist: "WSQ Other Artist",
      }),
      candidatePrinting(allowedCard.id, "wsq-cp-promo", {
        printingId: promoPrintingId,
        shortCode: "WSQ-002",
        markerSlugs: ["wsq-promo"],
        size: "oversized",
      }),
      candidatePrinting(allowedCard.id, "wsq-cp-same", { printingId: basePrintingId }),
      candidatePrinting(deniedCard.id, "wsq-cp-denied", {
        printingId: basePrintingId,
        rarity: "rare",
      }),
      candidatePrinting(draftCard.id, "wsq-cp-draft", { shortCode: "WSQ-009" }),
    ])
    .execute();
  const fresh = await db
    .insertInto("candidatePrintings")
    .values(candidatePrinting(allowedCard.id, "wsq-cp-new", { shortCode: "WSQ-003" }))
    .returning("id")
    .executeTakeFirstOrThrow();
  newCandidatePrintingId = fresh.id;

  await db
    .insertInto("adminEvents")
    .values([
      {
        actorUserId: ADMIN_ID,
        action: "printing.accept-field",
        entityType: "printing",
        entityId: promoPrintingId,
        entityLabel: "WSQ-002",
      },
      {
        actorUserId: ADMIN_ID,
        action: "image.upload",
        entityType: "image",
        entityId: imageId,
        entityLabel: "WSQ-002",
      },
    ])
    .execute();

  await refreshCardAggregates(db);
}

afterAll(async () => {
  if (!adminCtx) {
    return;
  }
  const { db } = adminCtx;
  await db.deleteFrom("candidateCards").where("id", "in", candidateCardIds).execute();
  await db.deleteFrom("faceImages").where("id", "=", imageId).execute();
  await db.deleteFrom("imageFiles").where("id", "=", imageFileId).execute();
  await deletePrintingsById(db, [basePrintingId, promoPrintingId]);
  await db.deleteFrom("cards").where("id", "=", cardId).execute();
  await db.deleteFrom("sets").where("id", "=", setId).execute();
  await db.deleteFrom("markers").where("slug", "=", "wsq-promo").execute();
  await db.deleteFrom("providerSettings").where("provider", "in", [ALLOWED, DENIED]).execute();
  await db.deleteFrom("adminEvents").where("actorUserId", "in", [ADMIN_ID, REVIEW_ID]).execute();
  await db.deleteFrom("adminGrants").where("userId", "in", [REVIEW_ID, DESK_ID]).execute();
  await db.deleteFrom("admins").where("userId", "=", ADMIN_ID).execute();
  await db
    .deleteFrom("users")
    .where("id", "in", [ADMIN_ID, REVIEW_ID, DESK_ID, PLAIN_ID])
    .execute();
});

describe.skipIf(!adminCtx)("Admin catalog workspace routes (integration)", () => {
  const { app: adminApp } = adminCtx!;
  const { app: reviewApp } = reviewCtx!;
  const { app: deskApp } = deskCtx!;
  const { app: plainApp } = plainCtx!;

  async function faceWork(app: typeof adminApp): Promise<Record<string, unknown>> {
    const res = await app.fetch(
      adminReq("GET", "/catalog/workspace/records?kind=face&filter=needs-review&q=WSQ"),
    );
    expect(res.status).toBe(200);
    const json = await readJson(res);
    return Object.fromEntries(
      (json.rows as { id: string; pendingImages?: number; pendingFields?: number }[]).map((row) => [
        row.id,
        { pendingImages: row.pendingImages, pendingFields: row.pendingFields },
      ]),
    );
  }

  describe("GET /catalog/workspace/candidate-printings/:id/card", () => {
    const lookup = (app: typeof adminApp, id: string) =>
      app.fetch(
        adminReq("GET", `/catalog/workspace/candidate-printings/${encodeURIComponent(id)}/card`),
      );

    it("returns 403 without a grant", async () => {
      const res = await lookup(plainApp, newCandidatePrintingId);
      expect(res.status).toBe(403);
    });

    it("returns the card of an open new printing", async () => {
      const res = await lookup(adminApp, newCandidatePrintingId);
      expect(res.status).toBe(200);
      expect(await readJson(res)).toEqual({ cardSlug: "wsq-poro-keeper" });
    });

    it("returns null to a desk holder, for an unknown id and for a listing id", async () => {
      for (const [app, id] of [
        [deskApp, newCandidatePrintingId],
        [adminApp, "0197a1b2-0000-7000-a000-000000000099"],
        [adminApp, "listing:tcgplayer:7:normal"],
      ] as const) {
        const res = await lookup(app, id);
        expect(res.status).toBe(200);
        expect(await readJson(res)).toEqual({ cardSlug: null });
      }
    });
  });

  describe("GET /catalog/workspace/records?kind=face (open work)", () => {
    it("counts every face source for an admin", async () => {
      const work = await faceWork(adminApp);
      expect(work[promoFaceId]).toMatchObject({ pendingImages: 1 });
      expect(work[baseFaceId]).toMatchObject({ pendingImages: 0 });
      expect((work[baseFaceId] as { pendingFields: number }).pendingFields).toBeGreaterThan(0);
    });

    it("limits a desk holder to uploads on promo faces", async () => {
      const work = await faceWork(deskApp);
      expect(Object.keys(work)).toEqual([promoFaceId]);
    });
  });

  describe("GET /catalog/workspace/review", () => {
    async function reviewCard(app: typeof adminApp, key: string) {
      const res = await app.fetch(adminReq("GET", "/catalog/workspace/review"));
      expect(res.status).toBe(200);
      const json = await readJson(res);
      return (
        json.cards as { key: string; providers: string[]; pending: Record<string, unknown> }[]
      ).find((card) => card.key === key);
    }

    async function restoreUpload() {
      await adminCtx!.db
        .updateTable("faceImages")
        .set({ reviewedAt: null })
        .where("id", "=", imageId)
        .execute();
      await adminCtx!.db
        .deleteFrom("adminEvents")
        .where("action", "=", "image.keep")
        .where("entityId", "=", imageId)
        .execute();
    }

    it("returns 403 to a desk holder", async () => {
      const res = await deskApp.fetch(adminReq("GET", "/catalog/workspace/review"));
      expect(res.status).toBe(403);
    });

    it("folds a card's open work into one row and lists the new card", async () => {
      const card = await reviewCard(adminApp, "wsq-poro-keeper");
      expect(card?.pending).toMatchObject({
        newPrintings: 1,
        faces: 1,
        printings: 1,
        newImages: 1,
      });
      expect(await reviewCard(adminApp, "new:wsqbrandnewcard")).toBeDefined();
    });

    it("lists every provider with open work to an admin", async () => {
      const card = await reviewCard(adminApp, "wsq-poro-keeper");
      expect(card?.providers).toEqual(expect.arrayContaining([ALLOWED, DENIED]));
    });

    it("hides providers helpers cannot review from a card-review holder", async () => {
      const card = await reviewCard(reviewApp, "wsq-poro-keeper");
      expect(card?.providers).toContain(ALLOWED);
      expect(card?.providers).not.toContain(DENIED);
      expect(await reviewCard(reviewApp, "new:wsqbrandnewcard")).toBeDefined();
    });

    it("drops an upload from the card once it is kept as an extra", async () => {
      const res = await adminApp.fetch(adminReq("POST", `/cards/printing-images/${imageId}/keep`));
      expect(res.status).toBe(204);

      const card = await reviewCard(adminApp, "wsq-poro-keeper");
      expect(card?.pending.newImages).toBe(0);

      await restoreUpload();
    });

    it("lets a card-review holder keep an upload as an extra", async () => {
      const res = await reviewApp.fetch(adminReq("POST", `/cards/printing-images/${imageId}/keep`));
      expect(res.status).toBe(204);

      const card = await reviewCard(reviewApp, "wsq-poro-keeper");
      expect(card?.pending.newImages).toBe(0);

      await restoreUpload();
    });

    it("puts a kept upload back up for review on unkeep", async () => {
      await reviewApp.fetch(adminReq("POST", `/cards/printing-images/${imageId}/keep`));
      const res = await reviewApp.fetch(
        adminReq("POST", `/cards/printing-images/${imageId}/unkeep`),
      );
      expect(res.status).toBe(204);

      const card = await reviewCard(reviewApp, "wsq-poro-keeper");
      expect(card?.pending.newImages).toBe(1);

      await adminCtx!.db
        .deleteFrom("adminEvents")
        .where("action", "in", ["image.keep", "image.unkeep"])
        .where("entityId", "=", imageId)
        .execute();
    });

    it("returns 403 to a desk holder on unkeep", async () => {
      const res = await deskApp.fetch(adminReq("POST", `/cards/printing-images/${imageId}/unkeep`));
      expect(res.status).toBe(403);
    });
  });

  describe("GET /catalog/workspace/listings", () => {
    it("returns 403 to a card-review holder", async () => {
      const res = await reviewApp.fetch(adminReq("GET", "/catalog/workspace/listings"));
      expect(res.status).toBe(403);
    });

    it("lists unassigned listings for an admin", async () => {
      const res = await adminApp.fetch(adminReq("GET", "/catalog/workspace/listings"));
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(Array.isArray(json.items)).toBe(true);
    });
  });

  describe("GET /catalog/workspace/records filters", () => {
    it("narrows printings to promos and counts the total", async () => {
      const res = await adminApp.fetch(
        adminReq("GET", "/catalog/workspace/records?kind=printing&q=WSQ%20Poro&filter=promo"),
      );
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.total).toBe(1);
      expect(json.rows).toEqual([
        expect.objectContaining({
          id: promoPrintingId,
          markers: ["WSQ Promo"],
          imageCount: 1,
          isDoubleSided: false,
          publicCode: "WSQ-002/50",
        }),
      ]);
    });

    it("narrows faces to those without an image", async () => {
      const res = await adminApp.fetch(
        adminReq("GET", "/catalog/workspace/records?kind=face&q=WSQ-00&filter=no-image"),
      );
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: baseFaceId, imageState: "none", artist: "WSQ Artist" }),
        ]),
      );
    });

    it("rejects a filter that does not apply to the kind", async () => {
      const res = await adminApp.fetch(
        adminReq("GET", "/catalog/workspace/records?kind=face&filter=promo"),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET /catalog/workspace/history", () => {
    it("lists a printing's events with its face images", async () => {
      const res = await adminApp.fetch(
        adminReq("GET", `/catalog/workspace/history?printingId=${promoPrintingId}`),
      );
      expect(res.status).toBe(200);
      const json = await readJson(res);
      const actions = (json.events as { action: string }[]).map((event) => event.action);
      expect(actions.toSorted()).toEqual(["image.upload", "printing.accept-field"]);
    });

    it("lists a face's events through its printings", async () => {
      const res = await reviewApp.fetch(
        adminReq("GET", `/catalog/workspace/history?faceId=${promoFaceId}`),
      );
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.events).toHaveLength(2);
    });

    it("lets a desk holder read a promo printing only", async () => {
      const promo = await deskApp.fetch(
        adminReq("GET", `/catalog/workspace/history?printingId=${promoPrintingId}`),
      );
      expect(promo.status).toBe(200);
      const promoJson = await readJson(promo);
      expect(promoJson.events).toEqual([]);
      const base = await deskApp.fetch(
        adminReq("GET", `/catalog/workspace/history?printingId=${basePrintingId}`),
      );
      expect(base.status).toBe(403);
      const baseFace = await deskApp.fetch(
        adminReq("GET", `/catalog/workspace/history?faceId=${baseFaceId}`),
      );
      expect(baseFace.status).toBe(403);
    });

    it("returns 404 for an unknown printing", async () => {
      const res = await adminApp.fetch(
        adminReq(
          "GET",
          "/catalog/workspace/history?printingId=0197a1b2-0000-7000-a000-000000000099",
        ),
      );
      expect(res.status).toBe(404);
    });

    it("rejects a request naming neither a printing nor a face", async () => {
      const res = await adminApp.fetch(adminReq("GET", "/catalog/workspace/history"));
      expect(res.status).toBe(400);
    });
  });

  describe("GET /catalog/workspace/records", () => {
    it("returns 403 without a grant", async () => {
      const res = await plainApp.fetch(adminReq("GET", "/catalog/workspace/records?kind=printing"));
      expect(res.status).toBe(403);
    });

    it("lists printings matching the search for an admin", async () => {
      const res = await adminApp.fetch(
        adminReq("GET", "/catalog/workspace/records?kind=printing&q=WSQ%20Poro"),
      );
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.rows.map((row: { id: string }) => row.id).toSorted()).toEqual(
        [basePrintingId, promoPrintingId].toSorted(),
      );
      expect(json.rows[0]).toMatchObject({ cardSlug: "wsq-poro-keeper", faceCount: 1 });
    });

    it("lists faces with their printing count", async () => {
      const res = await reviewApp.fetch(
        adminReq("GET", "/catalog/workspace/records?kind=face&q=WSQ-001"),
      );
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.rows).toEqual([
        expect.objectContaining({ id: baseFaceId, shortCode: "WSQ-001", printingCount: 1 }),
      ]);
    });

    it("pages with a cursor", async () => {
      const first = await readJson(
        await adminApp.fetch(
          adminReq("GET", "/catalog/workspace/records?kind=printing&q=WSQ%20Poro&limit=1"),
        ),
      );
      expect(first.rows).toHaveLength(1);
      expect(first.nextCursor).not.toBeNull();
      const second = await readJson(
        await adminApp.fetch(
          adminReq(
            "GET",
            `/catalog/workspace/records?kind=printing&q=WSQ%20Poro&limit=1&cursor=${encodeURIComponent(first.nextCursor)}`,
          ),
        ),
      );
      expect(second.rows).toHaveLength(1);
      expect(second.rows[0].id).not.toBe(first.rows[0].id);
    });

    it("rejects an invalid cursor", async () => {
      const res = await adminApp.fetch(
        adminReq("GET", "/catalog/workspace/records?kind=printing&cursor=not-a-cursor"),
      );
      expect(res.status).toBe(400);
    });

    it("limits a desk holder to promos and marks them", async () => {
      const res = await deskApp.fetch(
        adminReq("GET", "/catalog/workspace/records?kind=printing&q=WSQ%20Poro"),
      );
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.rows).toEqual([
        expect.objectContaining({ id: promoPrintingId, isPromo: true, createdByMe: false }),
      ]);
    });
  });
});
