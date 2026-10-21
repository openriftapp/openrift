import { afterAll, describe, expect, it } from "vitest";

import {
  adminReq,
  createTestContext,
  refreshCardAggregates,
  seedTestUser,
  syncCardCardTypes,
} from "../../../test/integration-context.js";
import { readJson } from "../../../test/read-json.js";

const ADMIN_ID = "a0000000-0541-4000-a000-000000000001";
const REVIEW_ID = "a0000000-0542-4000-a000-000000000001";
const PLAIN_ID = "a0000000-0543-4000-a000-000000000001";

const ALLOWED = "wsb-allowed";
const DENIED = "wsb-denied";

const adminCtx = createTestContext(ADMIN_ID);
const reviewCtx = createTestContext(REVIEW_ID);
const plainCtx = createTestContext(PLAIN_ID);

const cardIds: string[] = [];
const candidateCardIds: string[] = [];
let sameIds: string[] = [];

function query(provider: string, value = "3"): string {
  return `/catalog/workspace/same-difference?provider=${provider}&field=might&value=${value}`;
}

if (adminCtx) {
  const { db } = adminCtx;

  for (const id of [ADMIN_ID, REVIEW_ID, PLAIN_ID]) {
    await seedTestUser(db, { id });
  }
  await db
    .insertInto("admins")
    .values({ userId: ADMIN_ID })
    .onConflict((oc) => oc.column("userId").doNothing())
    .execute();
  await db
    .insertInto("adminGrants")
    .values({ userId: REVIEW_ID, section: "card-review" })
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

  for (const [slug, name] of [
    ["wsb-poro-herder", "WSB Poro Herder"],
    ["wsb-poro-rider", "WSB Poro Rider"],
    ["wsb-poro-snack", "WSB Poro Snack"],
  ] as const) {
    const card = await db
      .insertInto("cards")
      .values({
        slug,
        name,
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
    cardIds.push(card.id);
  }
  await syncCardCardTypes(db);

  const candidateCard = (provider: string, name: string, externalId: string, might: number) => ({
    provider,
    name,
    types: ["unit"],
    superTypes: [],
    domains: [],
    might,
    energy: 2,
    power: 1,
    mightBonus: null,
    rulesText: null,
    effectText: null,
    tags: [],
    shortCode: null,
    externalId,
    extraData: null,
  });
  const rows = await db
    .insertInto("candidateCards")
    .values([
      candidateCard(ALLOWED, "WSB Poro Herder", "wsb-herder", 3),
      candidateCard(ALLOWED, "WSB Poro Rider", "wsb-rider", 3),
      candidateCard(ALLOWED, "WSB Poro Snack", "wsb-snack", 4),
      candidateCard(DENIED, "WSB Poro Herder", "wsb-denied-herder", 3),
    ])
    .returning(["id", "externalId"])
    .execute();
  candidateCardIds.push(...rows.map((entry) => entry.id));
  sameIds = rows
    .filter((entry) => entry.externalId === "wsb-herder" || entry.externalId === "wsb-rider")
    .map((entry) => entry.id)
    .toSorted();

  await refreshCardAggregates(db);
}

afterAll(async () => {
  if (!adminCtx) {
    return;
  }
  const { db } = adminCtx;
  await db.deleteFrom("candidateCards").where("id", "in", candidateCardIds).execute();
  await db.deleteFrom("cards").where("id", "in", cardIds).execute();
  await db.deleteFrom("providerSettings").where("provider", "in", [ALLOWED, DENIED]).execute();
  await db.deleteFrom("adminEvents").where("actorUserId", "=", ADMIN_ID).execute();
  await db.deleteFrom("adminGrants").where("userId", "=", REVIEW_ID).execute();
  await db.deleteFrom("admins").where("userId", "=", ADMIN_ID).execute();
  await db.deleteFrom("users").where("id", "in", [ADMIN_ID, REVIEW_ID, PLAIN_ID]).execute();
});

describe.skipIf(!adminCtx)("Admin catalog workspace bulk routes (integration)", () => {
  // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by skipIf
  const { app: adminApp, db } = adminCtx!;
  // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by skipIf
  const { app: reviewApp } = reviewCtx!;
  // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by skipIf
  const { app: plainApp } = plainCtx!;

  describe("GET /catalog/workspace/same-difference", () => {
    it("returns 403 without a grant", async () => {
      const res = await plainApp.fetch(adminReq("GET", query(ALLOWED)));
      expect(res.status).toBe(403);
    });

    it("counts the provider's cards proposing the same value", async () => {
      const res = await adminApp.fetch(adminReq("GET", query(ALLOWED)));
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.count).toBe(2);
      expect(json.candidateCardIds.toSorted()).toEqual(sameIds);
      expect(json.cards).toEqual([
        { slug: "wsb-poro-herder", name: "WSB Poro Herder" },
        { slug: "wsb-poro-rider", name: "WSB Poro Rider" },
      ]);
    });

    it("lets a card-review holder read a reviewable provider only", async () => {
      const allowed = await reviewApp.fetch(adminReq("GET", query(ALLOWED)));
      const denied = await reviewApp.fetch(adminReq("GET", query(DENIED)));
      expect(allowed.status).toBe(200);
      expect(denied.status).toBe(403);
    });

    it("rejects a value that is not JSON", async () => {
      const res = await adminApp.fetch(adminReq("GET", query(ALLOWED, "%7Boops")));
      expect(res.status).toBe(400);
    });
  });

  describe("POST /catalog/workspace/same-difference/discard", () => {
    const body = { provider: ALLOWED, field: "might", value: "3" };

    it("returns 403 for a card-review holder", async () => {
      const res = await reviewApp.fetch(
        adminReq("POST", "/catalog/workspace/same-difference/discard", body),
      );
      expect(res.status).toBe(403);
    });

    it("checks every matching row and logs one event per card", async () => {
      const res = await adminApp.fetch(
        adminReq("POST", "/catalog/workspace/same-difference/discard", body),
      );
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.checked).toBe(2);
      expect(json.candidateCardIds.toSorted()).toEqual(sameIds);

      const checked = await db
        .selectFrom("candidateCards")
        .select("id")
        .where("id", "in", candidateCardIds)
        .where("checkedAt", "is not", null)
        .execute();
      expect(checked.map((entry) => entry.id).toSorted()).toEqual(sameIds);

      const events = await db
        .selectFrom("adminEvents")
        .select(["entityId", "cardSlug"])
        .where("actorUserId", "=", ADMIN_ID)
        .where("action", "=", "candidate-card.discard-same-difference")
        .execute();
      expect(events.map((entry) => entry.cardSlug).toSorted()).toEqual([
        "wsb-poro-herder",
        "wsb-poro-rider",
      ]);

      const after = await readJson(await adminApp.fetch(adminReq("GET", query(ALLOWED))));
      expect(after.count).toBe(0);
    });
  });
});
