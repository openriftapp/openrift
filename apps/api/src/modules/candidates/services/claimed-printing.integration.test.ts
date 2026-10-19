import { normalizeNameForIdentity } from "@openrift/shared/card-name";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type { CardSubmissionInput } from "@openrift/shared/contracts/card-submissions";
import { formatCompactUtcStamp } from "@openrift/shared/format-date";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTransact } from "../../../deps.js";
import {
  createDbContext,
  deletePrintingsByFace,
  insertPrinting,
  seedTestUser,
} from "../../../test/integration-context.js";
import { catalogMutationsRepo } from "../../catalog/repositories/catalog-mutations.js";
import { printingImagesRepo } from "../../catalog/repositories/printing-images.js";
import { candidateReviewRepo } from "../repositories/candidate-cards-review.js";
import { cardSubmissionsRepo } from "../repositories/card-submissions.js";
import { buildUserSubmissionCard, ingestUserSubmission } from "./ingest-user-submission.js";

// Uses the shared integration database. Uses prefix CPS- for entities it creates.

const USER_ID = crypto.randomUUID();
const ctx = createDbContext(USER_ID);

describe.skipIf(!ctx)("claimed printings on user submissions (integration)", () => {
  const { db } = ctx!;
  const transact = createTransact(db);
  const cardIds: Record<string, string> = {};
  let setId = "";
  let baseId = "";
  let promoId = "";
  let pairId = "";

  function sideValues(card: string, shortCode: string, markerSlugs: string[] = []) {
    return {
      cardId: cardIds[card]!,
      setId,
      shortCode,
      rarity: "common" as const,
      artVariant: "normal" as const,
      isSigned: false,
      isOvernumbered: false,
      markerSlugs,
      finish: "foil" as const,
      size: "standard" as const,
      artist: "CPS Artist",
      publicCode: shortCode,
      printedRulesText: null,
      printedEffectText: null,
      flavorText: null,
      language: "EN",
      printedName: null,
      printedYear: null,
    };
  }

  function imageSubmission(
    cardName: string,
    printing: { public_code: string; printing_id: string; marker_slugs?: string[] },
  ): CardSubmissionInput {
    return {
      slug: "cps-submission",
      card: { name: cardName },
      printings: [
        {
          set_id: "cps-test",
          set_name: "CPS Test Set",
          finish: "foil",
          language: "EN",
          image_url: `https://example.com/${printing.printing_id}.png`,
          ...printing,
        },
      ],
      submissionNote: null,
    };
  }

  async function submit(input: CardSubmissionInput) {
    const now = new Date();
    const result = await ingestUserSubmission(transact, {
      userId: USER_ID,
      submissionNote: null,
      card: buildUserSubmissionCard(input, USER_ID, formatCompactUtcStamp(now)),
      now,
    });
    const staged = await db
      .selectFrom("candidatePrintings as cp")
      .innerJoin("candidateCards as cc", "cc.id", "cp.candidateCardId")
      .innerJoin("cardSubmissions as cs", "cs.candidateCardId", "cc.id")
      .select(["cc.id as candidateCardId", "cp.printingId", "cs.kind", "cs.proposedDiff"])
      .where("cc.submittedByUserId", "=", USER_ID)
      .orderBy("cp.createdAt", "desc")
      .executeTakeFirst();
    return { result, staged };
  }

  async function deleteSubmissions() {
    await db.deleteFrom("cardSubmissions").where("userId", "=", USER_ID).execute();
    const candidates = db
      .selectFrom("candidateCards")
      .select("id")
      .where("provider", "=", USER_SUBMISSION_PROVIDER)
      .where("submittedByUserId", "=", USER_ID);
    await db.deleteFrom("candidatePrintings").where("candidateCardId", "in", candidates).execute();
    await db
      .deleteFrom("candidateCards")
      .where("provider", "=", USER_SUBMISSION_PROVIDER)
      .where("submittedByUserId", "=", USER_ID)
      .execute();
  }

  beforeAll(async () => {
    await seedTestUser(db, { id: USER_ID });
    const [set] = await db
      .insertInto("sets")
      .values({ slug: "cps-test", name: "CPS Test Set", printedTotal: 10, sortOrder: 947 })
      .returning("id")
      .execute();
    setId = set!.id;
    for (const name of ["CPS Heimer", "CPS Bird", "CPS Gold"]) {
      const [card] = await db
        .insertInto("cards")
        .values({
          name,
          slug: name.toLowerCase().replace(" ", "-"),
          type: "other",
          normName: normalizeNameForIdentity(name),
          keywords: [],
          tags: [],
        })
        .returning("id")
        .execute();
      cardIds[name] = card!.id;
    }
    const base = await insertPrinting(db, {
      ...sideValues("CPS Heimer", "CPS-001"),
      comment: null,
    });
    const promo = await insertPrinting(db, {
      ...sideValues("CPS Heimer", "CPS-001", ["promo"]),
      comment: null,
    });
    baseId = base.id;
    promoId = promo.id;
    const { faceId: goldFaceId } = await insertPrinting(db, {
      ...sideValues("CPS Gold", "CPS-T05"),
      comment: null,
    });
    pairId = await catalogMutationsRepo(db).upsertPrinting(
      sideValues("CPS Bird", "CPS-T01"),
      goldFaceId,
    );
  });

  afterAll(async () => {
    await deleteSubmissions();
    await deletePrintingsByFace(db, "setId", "=", setId);
    await db.deleteFrom("cards").where("id", "in", Object.values(cardIds)).execute();
    await db.deleteFrom("sets").where("id", "=", setId).execute();
    await db.deleteFrom("users").where("id", "=", USER_ID).execute();
  });

  it("links an image for a promo to the promo and records its missing art", async () => {
    await deleteSubmissions();
    const { result, staged } = await submit(
      imageSubmission("CPS Heimer", {
        public_code: "CPS-001",
        printing_id: promoId,
        marker_slugs: ["promo"],
      }),
    );

    expect(result.status).toBe("ok");
    expect(staged?.printingId).toBe(promoId);
    expect(staged?.kind).toBe("image");
    expect(staged?.proposedDiff).toEqual(["printing.CPS-001:foil:promo:EN.image"]);
  });

  it("links a markerless payload to the promo it claims", async () => {
    await deleteSubmissions();
    const { staged } = await submit(
      imageSubmission("CPS Heimer", { public_code: "CPS-001", printing_id: promoId }),
    );

    expect(staged?.printingId).toBe(promoId);
    expect(staged?.printingId).not.toBe(baseId);
  });

  it("links an image from the back side's card to the two-sided printing", async () => {
    await deleteSubmissions();
    const { result, staged } = await submit(
      imageSubmission("CPS Gold", { public_code: "CPS-T05", printing_id: pairId }),
    );

    expect(result.status).toBe("ok");
    expect(staged?.printingId).toBe(pairId);
    expect(staged?.proposedDiff).toEqual(["printing.CPS-T05:foil::EN.image"]);
  });

  it("keeps the claimed link on the review-time proposal", async () => {
    await deleteSubmissions();
    const { staged } = await submit(
      imageSubmission("CPS Heimer", { public_code: "CPS-001", printing_id: promoId }),
    );

    const proposal = await candidateReviewRepo(db).proposalForCandidate(staged!.candidateCardId);
    expect(proposal?.printings.map((printing) => printing.printingId)).toEqual([promoId]);
  });

  it("ignores a claimed printing of another card and links by key", async () => {
    await deleteSubmissions();
    const { result, staged } = await submit(
      imageSubmission("CPS Heimer", { public_code: "CPS-001", printing_id: pairId }),
    );

    expect(result.status).toBe("ok");
    expect(staged?.printingId).toBe(baseId);
  });

  it("snapshots every side of a requested printing, front first", async () => {
    const { snapshot } = await cardSubmissionsRepo(db).liveSnapshot(cardIds["CPS Gold"]!, {
      shortCodes: [],
      printingIds: [pairId],
    });
    const sides = await db
      .selectFrom("printingSidesOrdered")
      .select("shortCode")
      .where("printingId", "=", pairId)
      .orderBy("position")
      .execute();

    expect(snapshot.printingsById.get(pairId)?.map((side) => side.shortCode)).toEqual(
      sides.map((side) => side.shortCode),
    );
  });

  it("picks the face whose short code a submission names", async () => {
    const repo = printingImagesRepo(db);
    const sides = await db
      .selectFrom("printingSidesOrdered")
      .select(["shortCode", "position"])
      .where("printingId", "=", pairId)
      .execute();
    const back = sides.find((side) => side.position === 2)!;
    const front = sides.find((side) => side.position === 1)!;

    expect(await repo.faceForShortCode(pairId, back.shortCode.toLowerCase())).toBe("back");
    expect(await repo.faceForShortCode(pairId, front.shortCode)).toBe("front");
    expect(await repo.faceForShortCode(pairId, "CPS-999")).toBe("front");
    expect(await repo.faceForShortCode(promoId, "CPS-001")).toBe("front");
  });
});
