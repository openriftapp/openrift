import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDbContext,
  deletePrintingsById,
  insertPrintings,
  seedTestUser,
} from "../../../test/integration-context.js";
import { cardSubmissionsRepo } from "./card-submissions.js";

const userId = crypto.randomUUID();
const otherUserId = crypto.randomUUID();
const setId = crypto.randomUUID();
const laterSetId = crypto.randomUUID();
const cardId = crypto.randomUUID();
const groupId = crypto.randomUUID();

const NO_IMAGE = crypto.randomUUID();
const NO_IMAGE_LATER_SET = crypto.randomUUID();
const HAS_IMAGE = crypto.randomUUID();
const INACTIVE_IMAGE = crypto.randomUUID();
const PENDING_SUBMISSION = crypto.randomUUID();
const SETTLED_SUBMISSION = crypto.randomUUID();
const GROUP_ONLY = crypto.randomUUID();
const OTHER_USER_ONLY = crypto.randomUUID();
const SHARED_SIDE = crypto.randomUUID();
const TOKEN_A = crypto.randomUUID();
const TOKEN_B = crypto.randomUUID();
const PENDING_SHARED_SIDE = crypto.randomUUID();
const TOKEN_C = crypto.randomUUID();
const TOKEN_D = crypto.randomUUID();

const ctx = createDbContext(userId);

describe.skipIf(!ctx)("missingImagesForUser (integration)", () => {
  const { db } = ctx!;
  const repo = cardSubmissionsRepo(db);

  let collectionId = "";
  let groupCollectionId = "";
  let otherCollectionId = "";
  const imageFileIds: string[] = [];
  const candidateCardIds: string[] = [];

  function printing(id: string, code: string, options: { setId?: string } = {}) {
    return {
      id,
      cardId,
      setId: options.setId ?? setId,
      shortCode: code,
      publicCode: `${code}/004`,
      rarity: "common",
      artVariant: "normal",
      isSigned: false,
      finish: "normal",
      size: "standard",
      language: "EN",
      artist: "A. Painter",
    };
  }

  async function activeImage(printingId: string, isActive: boolean) {
    const file = await db
      .insertInto("imageFiles")
      .values({ rehostedUrl: `/media/cards/aa/${crypto.randomUUID()}` })
      .returning("id")
      .executeTakeFirstOrThrow();
    imageFileIds.push(file.id);
    await db
      .insertInto("faceImages")
      .values({ faceId: printingId, imageFileId: file.id, isActive })
      .execute();
  }

  async function imageSubmission(
    printingId: string,
    status: "pending" | "rejected",
    shortCode = "MIS-001",
  ) {
    const candidate = await db
      .insertInto("candidateCards")
      .values({
        provider: USER_SUBMISSION_PROVIDER,
        externalId: `missing-images-${printingId}`,
        name: `Missing Images ${printingId}`,
        normName: `missingimages${printingId}`,
        domains: [],
        submittedByUserId: userId,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    candidateCardIds.push(candidate.id);
    await db
      .insertInto("candidatePrintings")
      .values({
        candidateCardId: candidate.id,
        printingId,
        shortCode,
        externalId: `missing-images-p-${printingId}`,
        imageUrl: "/media/submissions/0198f000-0000-7000-8000-00000000000a.jpg",
      })
      .execute();
    await db
      .insertInto("cardSubmissions")
      .values({
        userId,
        provider: USER_SUBMISSION_PROVIDER,
        externalId: `missing-images-${printingId}`,
        candidateCardId: candidate.id,
        kind: "image",
        cardName: "Missing Images",
        status,
        resolvedAt: status === "pending" ? null : new Date(),
      })
      .execute();
  }

  beforeAll(async () => {
    await seedTestUser(db, { id: userId });
    await seedTestUser(db, { id: otherUserId });

    await db
      .insertInto("sets")
      .values([
        { id: setId, slug: "MIS", name: "Missing Images", sortOrder: 9001 },
        { id: laterSetId, slug: "MIS2", name: "Missing Images Two", sortOrder: 9002 },
      ])
      .execute();
    await db
      .insertInto("cards")
      .values({
        id: cardId,
        slug: "missing-images-card",
        name: "Missing Images Card",
        type: "unit",
      })
      .execute();

    await insertPrintings(db, [
      printing(NO_IMAGE, "MIS-002"),
      printing(NO_IMAGE_LATER_SET, "MIS-001", { setId: laterSetId }),
      printing(HAS_IMAGE, "MIS-003"),
      printing(INACTIVE_IMAGE, "MIS-004"),
      printing(PENDING_SUBMISSION, "MIS-006"),
      printing(SETTLED_SUBMISSION, "MIS-007"),
      printing(GROUP_ONLY, "MIS-008"),
      printing(OTHER_USER_ONLY, "MIS-009"),
      printing(SHARED_SIDE, "MIS"),
      printing(TOKEN_A, "MIS-T01"),
      printing(TOKEN_B, "MIS-T02"),
      printing(PENDING_SHARED_SIDE, "MISP"),
      printing(TOKEN_C, "MISP-T01"),
      printing(TOKEN_D, "MISP-T02"),
    ]);
    await db
      .updateTable("printings")
      .set({ face2Id: SHARED_SIDE })
      .where("id", "in", [TOKEN_A, TOKEN_B])
      .execute();
    await db
      .updateTable("printings")
      .set({ face2Id: PENDING_SHARED_SIDE })
      .where("id", "in", [TOKEN_C, TOKEN_D])
      .execute();

    await activeImage(HAS_IMAGE, true);
    await activeImage(INACTIVE_IMAGE, false);
    await imageSubmission(PENDING_SUBMISSION, "pending");
    await imageSubmission(SETTLED_SUBMISSION, "rejected");
    await imageSubmission(TOKEN_C, "pending", "misp");

    await db
      .insertInto("friendGroups")
      .values({ id: groupId, slug: `mis-${groupId.slice(0, 8)}`, name: "Missing Images Group" })
      .execute();

    const collections = await db
      .insertInto("collections")
      .values([
        { userId, name: "Missing Images Own" },
        { groupId, name: "Missing Images Shared" },
        { userId: otherUserId, name: "Missing Images Other" },
      ])
      .returning(["id", "name"])
      .execute();
    collectionId = collections.find((c) => c.name === "Missing Images Own")!.id;
    groupCollectionId = collections.find((c) => c.name === "Missing Images Shared")!.id;
    otherCollectionId = collections.find((c) => c.name === "Missing Images Other")!.id;

    await db
      .insertInto("copies")
      .values([
        { collectionId, printingId: NO_IMAGE },
        { collectionId, printingId: NO_IMAGE },
        { collectionId, printingId: NO_IMAGE_LATER_SET },
        { collectionId, printingId: HAS_IMAGE },
        { collectionId, printingId: INACTIVE_IMAGE },
        { collectionId, printingId: PENDING_SUBMISSION },
        { collectionId, printingId: SETTLED_SUBMISSION },
        { collectionId, printingId: TOKEN_A },
        { collectionId, printingId: TOKEN_B },
        { collectionId, printingId: TOKEN_C },
        { collectionId, printingId: TOKEN_D },
        { collectionId: groupCollectionId, printingId: GROUP_ONLY },
        { collectionId: otherCollectionId, printingId: OTHER_USER_ONLY },
      ])
      .execute();
  });

  afterAll(async () => {
    const printingIds = [
      NO_IMAGE,
      NO_IMAGE_LATER_SET,
      HAS_IMAGE,
      INACTIVE_IMAGE,
      PENDING_SUBMISSION,
      SETTLED_SUBMISSION,
      GROUP_ONLY,
      OTHER_USER_ONLY,
      TOKEN_A,
      TOKEN_B,
      TOKEN_C,
      TOKEN_D,
      SHARED_SIDE,
      PENDING_SHARED_SIDE,
    ];
    await db.deleteFrom("copies").where("printingId", "in", printingIds).execute();
    await db
      .deleteFrom("collections")
      .where("id", "in", [collectionId, groupCollectionId, otherCollectionId])
      .execute();
    await db.deleteFrom("friendGroups").where("id", "=", groupId).execute();
    await db
      .deleteFrom("cardSubmissions")
      .where("candidateCardId", "in", candidateCardIds)
      .execute();
    await db
      .deleteFrom("candidatePrintings")
      .where("candidateCardId", "in", candidateCardIds)
      .execute();
    await db.deleteFrom("candidateCards").where("id", "in", candidateCardIds).execute();
    await db.deleteFrom("faceImages").where("faceId", "in", printingIds).execute();
    await db.deleteFrom("imageFiles").where("id", "in", imageFileIds).execute();
    await deletePrintingsById(db, printingIds);
    await db.deleteFrom("cards").where("id", "=", cardId).execute();
    await db.deleteFrom("sets").where("id", "in", [setId, laterSetId]).execute();
    await db.deleteFrom("users").where("id", "in", [userId, otherUserId]).execute();
  });

  it("reports one row per owned printing without front artwork", async () => {
    const rows = await repo.missingImagesForUser(userId);
    const mine = rows.filter((row) => /^MIS-\d/u.test(row.shortCode));

    expect(mine.map((row) => row.printingId)).toStrictEqual([
      NO_IMAGE,
      INACTIVE_IMAGE,
      SETTLED_SUBMISSION,
      NO_IMAGE_LATER_SET,
    ]);
  });

  it("counts the copies the user holds and carries the display fields", async () => {
    const rows = await repo.missingImagesForUser(userId);
    const row = rows.find((entry) => entry.printingId === NO_IMAGE);

    expect(row).toStrictEqual({
      printingId: NO_IMAGE,
      side: 1,
      cardSlug: "missing-images-card",
      cardName: "Missing Images Card",
      setSlug: "MIS",
      setName: "Missing Images",
      shortCode: "MIS-002",
      publicCode: "MIS-002/004",
      finish: "normal",
      language: "EN",
      copies: 2,
    });
  });

  it("hides a printing an image submission is already pending on", async () => {
    const rows = await repo.missingImagesForUser(userId);

    expect(rows.some((row) => row.printingId === PENDING_SUBMISSION)).toBe(false);
    expect(rows.some((row) => row.printingId === SETTLED_SUBMISSION)).toBe(true);
  });

  it("lists a side shown on several printings once, with the copies of all of them", async () => {
    const rows = await repo.missingImagesForUser(userId);
    const shared = rows.filter((row) => row.shortCode === "MIS");

    expect(shared).toHaveLength(1);
    expect(shared[0]?.copies).toBe(2);
    expect(rows.filter((row) => row.shortCode.startsWith("MIS-T0"))).toHaveLength(2);
  });

  it("hides a shared side once an image for it is pending through any printing", async () => {
    const rows = await repo.missingImagesForUser(userId);

    expect(rows.some((row) => row.shortCode === "MISP")).toBe(false);
    expect(rows.some((row) => row.shortCode === "MISP-T01")).toBe(true);
    expect(rows.some((row) => row.shortCode === "MISP-T02")).toBe(true);
  });

  it("ignores copies held in a group collection or by another user", async () => {
    const rows = await repo.missingImagesForUser(userId);

    expect(rows.some((row) => row.printingId === GROUP_ONLY)).toBe(false);
    expect(rows.some((row) => row.printingId === OTHER_USER_ONLY)).toBe(false);
  });
});
