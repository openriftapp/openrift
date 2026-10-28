import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDbContext,
  deletePrintingsById,
  insertCards,
  insertPrintings,
  seedTestUser,
} from "../../../test/integration-context.js";
import { cardSubmissionsRepo } from "./card-submissions.js";

const userId = crypto.randomUUID();
const setId = crypto.randomUUID();
const cardId = crypto.randomUUID();
const PRINTING = crypto.randomUUID();
const PASTED_URL = `https://example.test/linked-image/${crypto.randomUUID()}.png`;
const LIVE_URL = `https://example.test/linked-image/${crypto.randomUUID()}.png`;

const ctx = createDbContext(userId);

describe.skipIf(!ctx)("linkedImageAttached (integration)", () => {
  const { db } = ctx!;
  const repo = cardSubmissionsRepo(db);
  const imageFileIds: string[] = [];
  const candidateCardIds: string[] = [];

  async function attach(originalUrl: string, isActive: boolean, createdAt?: Date) {
    const file = await db
      .insertInto("imageFiles")
      .values({ originalUrl })
      .returning("id")
      .executeTakeFirstOrThrow();
    imageFileIds.push(file.id);
    await db
      .insertInto("faceImages")
      .values({ faceId: PRINTING, imageFileId: file.id, isActive, createdAt })
      .execute();
  }

  async function candidate(imageUrl: string): Promise<string> {
    const row = await db
      .insertInto("candidateCards")
      .values({
        provider: USER_SUBMISSION_PROVIDER,
        externalId: `linked-image-${crypto.randomUUID()}`,
        name: "Linked Image",
        normName: "linkedimage",
        domains: [],
        submittedByUserId: userId,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    candidateCardIds.push(row.id);
    await db
      .insertInto("candidatePrintings")
      .values({
        candidateCardId: row.id,
        printingId: PRINTING,
        shortCode: "LIM-001",
        externalId: `linked-image-p-${row.id}`,
        imageUrl,
      })
      .execute();
    return row.id;
  }

  beforeAll(async () => {
    await seedTestUser(db, { id: userId });
    await db
      .insertInto("sets")
      .values({ id: setId, slug: "LIM", name: "Linked Image", sortOrder: 9101 })
      .execute();
    await insertCards(db, {
      id: cardId,
      slug: "linked-image-card",
      name: "Linked Image Card",
      types: ["unit"],
    });
    await insertPrintings(db, [
      {
        id: PRINTING,
        cardId,
        setId,
        shortCode: "LIM-001",
        publicCode: "LIM-001/004",
        rarity: "common",
        artVariant: "normal",
        isSigned: false,
        finish: "normal",
        size: "standard",
        language: "EN",
        artist: "A. Painter",
      },
    ]);
    await attach(LIVE_URL, true, new Date("2020-01-01T00:00:00Z"));
  });

  afterAll(async () => {
    await db
      .deleteFrom("candidatePrintings")
      .where("candidateCardId", "in", candidateCardIds)
      .execute();
    await db.deleteFrom("candidateCards").where("id", "in", candidateCardIds).execute();
    await db.deleteFrom("faceImages").where("faceId", "=", PRINTING).execute();
    await db.deleteFrom("imageFiles").where("id", "in", imageFileIds).execute();
    await deletePrintingsById(db, [PRINTING]);
    await db.deleteFrom("cards").where("id", "=", cardId).execute();
    await db.deleteFrom("sets").where("id", "=", setId).execute();
    await db.deleteFrom("users").where("id", "=", userId).execute();
  });

  it("is false before the pasted URL is attached", async () => {
    const candidateCardId = await candidate(PASTED_URL);
    expect(await repo.linkedImageAttached(candidateCardId)).toBe(false);
  });

  it("is true once the pasted URL is attached to the linked printing", async () => {
    const candidateCardId = await candidate(PASTED_URL);
    await attach(PASTED_URL, false);
    expect(await repo.linkedImageAttached(candidateCardId)).toBe(true);
  });

  it("ignores an image that was already live when the suggestion came in", async () => {
    const candidateCardId = await candidate(LIVE_URL);
    expect(await repo.linkedImageAttached(candidateCardId)).toBe(false);
  });
});
