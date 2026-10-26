import { afterAll, describe, expect, it } from "vitest";

import {
  adminReq,
  createTestContext,
  deletePrintingsById,
  insertPrinting,
  refreshCardAggregates,
  seedTestUser,
  syncCardCardTypes,
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

interface QueueItem {
  id: string;
  owner: string;
  segment: string;
  reason: string;
  cardSlug: string | null;
}

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
        helperReviewable: true,
        isFavorite: false,
        isHidden: false,
        sortOrder: 0,
      },
      {
        provider: DENIED,
        helperReviewable: false,
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

  const card = await db
    .insertInto("cards")
    .values({
      slug: "wsq-poro-keeper",
      name: "WSQ Poro Keeper",
      type: "unit",
      might: 2,
      energy: 2,
      power: 1,
      mightBonus: null,
      keywords: [],
      tags: [],
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  cardId = card.id;
  await syncCardCardTypes(db);

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

  const file = await db
    .insertInto("imageFiles")
    .values({ rehostedUrl: "/media/cards/wsq/upload" })
    .returning("id")
    .executeTakeFirstOrThrow();
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
        action: "card.accept-field",
        entityType: "card",
        entityId: cardId,
        cardSlug: "wsq-poro-keeper",
      },
      {
        actorUserId: ADMIN_ID,
        action: "candidates.upload",
        entityType: "upload",
        entityId: ALLOWED,
        entityLabel: ALLOWED,
        newValues: { newCards: 1, newPrintings: 2, updates: 1, printingUpdates: 1 },
      },
      {
        actorUserId: ADMIN_ID,
        action: "candidates.upload",
        entityType: "upload",
        entityId: DENIED,
        entityLabel: DENIED,
        newValues: { newCards: 0 },
      },
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
  await db.deleteFrom("adminEvents").where("actorUserId", "=", ADMIN_ID).execute();
  await db.deleteFrom("adminGrants").where("userId", "in", [REVIEW_ID, DESK_ID]).execute();
  await db.deleteFrom("admins").where("userId", "=", ADMIN_ID).execute();
  await db
    .deleteFrom("users")
    .where("id", "in", [ADMIN_ID, REVIEW_ID, DESK_ID, PLAIN_ID])
    .execute();
});

describe.skipIf(!adminCtx)("Admin catalog workspace routes (integration)", () => {
  // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by skipIf
  const { app: adminApp } = adminCtx!;
  // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by skipIf
  const { app: reviewApp } = reviewCtx!;
  // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by skipIf
  const { app: deskApp } = deskCtx!;
  // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by skipIf
  const { app: plainApp } = plainCtx!;

  async function queueIds(app: typeof adminApp, query = ""): Promise<string[]> {
    const res = await app.fetch(adminReq("GET", `/catalog/workspace/queue${query}`));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    return (json.items as QueueItem[])
      .filter((item) => item.cardSlug === "wsq-poro-keeper" || item.id.includes("wsqbrandnew"))
      .map((item) => item.id)
      .toSorted();
  }

  describe("GET /catalog/workspace/queue", () => {
    it("returns 403 without a grant", async () => {
      const res = await plainApp.fetch(adminReq("GET", "/catalog/workspace/queue"));
      expect(res.status).toBe(403);
    });

    it("sorts every open input into its owner's queue for an admin", async () => {
      expect(await queueIds(adminApp)).toEqual(
        [
          "card:new-card:wsqbrandnewcard",
          "card:source-difference:wsq-poro-keeper:wsq-allowed",
          `face:new-image:${promoFaceId}:${imageId}`,
          `face:source-difference:${baseFaceId}:wsq-allowed`,
          `face:source-difference:${baseFaceId}:wsq-denied`,
          `printing:new-printing:${newCandidatePrintingId}`,
          `printing:source-difference:${promoPrintingId}:wsq-allowed`,
        ].toSorted(),
      );
    });

    it("counts the caller's admin events today", async () => {
      const res = await adminApp.fetch(adminReq("GET", "/catalog/workspace/queue"));
      const json = await readJson(res);
      expect(json.doneToday).toBeGreaterThanOrEqual(1);
      expect(json.counts.card.new).toBeGreaterThanOrEqual(1);
    });

    it("narrows items to the requested owner", async () => {
      const res = await adminApp.fetch(adminReq("GET", "/catalog/workspace/queue?owner=face"));
      const json = await readJson(res);
      expect((json.items as QueueItem[]).every((item) => item.owner === "face")).toBe(true);
    });

    it("hides sources helpers cannot review from a card-review holder", async () => {
      const ids = await queueIds(reviewApp);
      expect(ids).toContain(`face:source-difference:${baseFaceId}:wsq-allowed`);
      expect(ids).not.toContain(`face:source-difference:${baseFaceId}:wsq-denied`);
      expect(ids).toContain("card:new-card:wsqbrandnewcard");
    });

    it("limits a desk holder to promo printings and uploads on their faces", async () => {
      expect(await queueIds(deskApp)).toEqual(
        [
          `face:new-image:${promoFaceId}:${imageId}`,
          `printing:source-difference:${promoPrintingId}:wsq-allowed`,
        ].toSorted(),
      );
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

  describe("GET /catalog/workspace/uploads", () => {
    it("returns 403 to a desk holder", async () => {
      const res = await deskApp.fetch(adminReq("GET", "/catalog/workspace/uploads"));
      expect(res.status).toBe(403);
    });

    it("lists each provider's newest upload with its open items for an admin", async () => {
      const res = await adminApp.fetch(adminReq("GET", "/catalog/workspace/uploads"));
      expect(res.status).toBe(200);
      const json = await readJson(res);
      const sources = json.sources as { provider: string; open: number }[];
      expect(sources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider: ALLOWED,
            newCards: 1,
            newPrintings: 2,
            updates: 2,
          }),
          expect.objectContaining({ provider: DENIED }),
        ]),
      );
      expect(sources.find((source) => source.provider === ALLOWED)?.open).toBeGreaterThan(0);
    });

    it("hides sources helpers cannot review from a card-review holder", async () => {
      const res = await reviewApp.fetch(adminReq("GET", "/catalog/workspace/uploads"));
      expect(res.status).toBe(200);
      const json = await readJson(res);
      const providers = (json.sources as { provider: string }[]).map((s) => s.provider);
      expect(providers).toContain(ALLOWED);
      expect(providers).not.toContain(DENIED);
    });
  });

  describe("GET /catalog/workspace/decisions", () => {
    it("lists the caller's own events today", async () => {
      const res = await adminApp.fetch(adminReq("GET", "/catalog/workspace/decisions"));
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ action: "card.accept-field", label: "wsq-poro-keeper" }),
        ]),
      );
    });

    it("returns nothing for a caller without events", async () => {
      const res = await reviewApp.fetch(adminReq("GET", "/catalog/workspace/decisions"));
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.events).toEqual([]);
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
