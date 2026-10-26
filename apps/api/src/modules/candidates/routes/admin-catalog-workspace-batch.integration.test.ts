import { afterAll, describe, expect, it } from "vitest";

import {
  adminReq,
  createTestContext,
  refreshCardAggregates,
  seedTestUser,
  syncCardCardTypes,
} from "../../../test/integration-context.js";
import { readJson } from "../../../test/read-json.js";

const ADMIN_ID = "a0000000-0551-4000-a000-000000000001";
const REVIEW_ID = "a0000000-0552-4000-a000-000000000001";

const TRUSTED = "wsbt-trusted";

const adminCtx = createTestContext(ADMIN_ID);
const reviewCtx = createTestContext(REVIEW_ID);

const cardIds: string[] = [];
const candidateCardIds: string[] = [];
let newPrintingId = "";

if (adminCtx) {
  const { db } = adminCtx;

  for (const id of [ADMIN_ID, REVIEW_ID]) {
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
    .values({
      provider: TRUSTED,
      helperReviewable: true,
      isFavorite: true,
      isHidden: false,
      sortOrder: 0,
    })
    .onConflict((oc) => oc.column("provider").doNothing())
    .execute();

  const card = await db
    .insertInto("cards")
    .values({
      slug: "wsbt-poro-herder",
      name: "WSBT Poro Herder",
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
  await syncCardCardTypes(db);

  const candidateCard = (name: string, externalId: string) => ({
    provider: TRUSTED,
    name,
    types: ["unit"],
    superTypes: [],
    domains: [],
    might: 2,
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
      candidateCard("WSBT Poro Herder", "wsbt-herder"),
      candidateCard("WSBT Gromp Whisperer", "wsbt-gromp"),
      candidateCard("WSBT Poro Herder, Fluffy", "wsbt-herder-fluffy"),
    ])
    .returning(["id", "externalId"])
    .execute();
  candidateCardIds.push(...rows.map((entry) => entry.id));
  const idOf = (externalId: string) => rows.find((entry) => entry.externalId === externalId)!.id;

  const candidatePrinting = (candidateCardId: string, shortCode: string, externalId: string) => ({
    candidateCardId,
    shortCode,
    setId: "wsbt",
    setName: "WSBT Set",
    rarity: "common",
    finish: "normal",
    artist: "Kudos Productions",
    publicCode: `${shortCode}/100`,
    language: "EN",
    externalId,
  });
  const printings = await db
    .insertInto("candidatePrintings")
    .values([
      candidatePrinting(idOf("wsbt-herder"), "WSBT-001", "wsbt-herder-001"),
      candidatePrinting(idOf("wsbt-gromp"), "WSBT-002", "wsbt-gromp-002"),
      candidatePrinting(idOf("wsbt-herder-fluffy"), "WSBT-003", "wsbt-fluffy-003"),
    ])
    .returning(["id", "externalId"])
    .execute();
  newPrintingId = printings.find((entry) => entry.externalId === "wsbt-herder-001")!.id;

  await refreshCardAggregates(db);
}

afterAll(async () => {
  if (!adminCtx) {
    return;
  }
  const { db } = adminCtx;
  await db.deleteFrom("candidateCards").where("id", "in", candidateCardIds).execute();
  await db.deleteFrom("cards").where("id", "in", cardIds).execute();
  await db.deleteFrom("providerSettings").where("provider", "=", TRUSTED).execute();
  await db.deleteFrom("adminEvents").where("actorUserId", "=", ADMIN_ID).execute();
  await db.deleteFrom("adminGrants").where("userId", "=", REVIEW_ID).execute();
  await db.deleteFrom("admins").where("userId", "=", ADMIN_ID).execute();
  await db.deleteFrom("users").where("id", "in", [ADMIN_ID, REVIEW_ID]).execute();
});

describe.skipIf(!adminCtx)("Admin catalog workspace batch routes (integration)", () => {
  // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by skipIf
  const { app: adminApp } = adminCtx!;
  // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by skipIf
  const { app: reviewApp } = reviewCtx!;

  it("lists trusted new cards without a similar live card", async () => {
    const res = await adminApp.fetch(adminReq("GET", "/catalog/workspace/batch/trusted-cards"));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.names).toContain("WSBT Gromp Whisperer");
    expect(json.names).not.toContain("WSBT Poro Herder, Fluffy");
    expect(json.count).toBe(json.names.length);
  });

  it("lists trusted new printings on existing cards", async () => {
    const res = await adminApp.fetch(adminReq("GET", "/catalog/workspace/batch/trusted-printings"));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.items).toContainEqual({
      candidatePrintingId: newPrintingId,
      cardSlug: "wsbt-poro-herder",
      label: "WSBT-001 normal EN",
    });
  });

  it("returns the suggested listings shape", async () => {
    const res = await adminApp.fetch(
      adminReq("GET", "/catalog/workspace/batch/suggested-listings"),
    );
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.count).toBe(json.items.length);
  });

  it("assigns nothing for unknown listing keys", async () => {
    const res = await adminApp.fetch(
      adminReq("POST", "/catalog/workspace/batch/suggested-listings", {
        listingKeys: ["tcgplayer::0::normal::"],
      }),
    );
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ assigned: 0 });
  });

  it("returns 403 for a card-review holder", async () => {
    for (const path of ["trusted-cards", "trusted-printings", "suggested-listings"]) {
      const read = await reviewApp.fetch(adminReq("GET", `/catalog/workspace/batch/${path}`));
      const write = await reviewApp.fetch(adminReq("POST", `/catalog/workspace/batch/${path}`, {}));
      expect(read.status).toBe(403);
      expect(write.status).toBe(403);
    }
  });
});
