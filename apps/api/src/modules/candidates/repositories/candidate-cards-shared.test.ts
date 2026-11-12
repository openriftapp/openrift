import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { printingImagesRepo } from "../../catalog/repositories/printing-images.js";
import { candidateCardDetailRepo } from "./candidate-cards-detail.js";
import { candidateFingerprintsRepo } from "./candidate-cards-fingerprints.js";
import { candidateMatchingRepo } from "./candidate-cards-matching.js";
import { candidateReviewRepo } from "./candidate-cards-review.js";
import { cardSubmissionsRepo } from "./card-submissions.js";
import { workspaceBatchRepo } from "./workspace-batch.js";
import { workspaceQueueRepo } from "./workspace-queue.js";

function expectAcceptableFilter(query: string | undefined) {
  expect(query).toContain('"cp"."printing_id" is null');
  expect(query).toContain('"ignored_candidate_cards"');
  expect(query).toContain('"ignored_candidate_printings"');
  expect(query).toMatch(/"provider_settings".*"is_hidden"/su);
}

describe("acceptableCandidatePrinting", () => {
  it("filters favorites and gallery candidates as unlinked, unignored and from a visible source", async () => {
    const { db, queries } = createRecordingDb([[]]);

    await candidateCardDetailRepo(db).acceptableCandidatePrintings(["cc-1"]);

    expectAcceptableFilter(queries[0]);
  });

  it("filters the trusted batch with the same rule", async () => {
    const { db, queries } = createRecordingDb([[]]);

    await workspaceBatchRepo(db).trustedNewPrintings(["gallery"]);

    expectAcceptableFilter(queries[0]);
  });
});

describe("liveCardForNorm", () => {
  const guarded = /"cc"\."norm_name" <> ''.*c\.norm_name = "cc"\."norm_name".*card_name_aliases/su;

  it("guards an empty name and checks the card name before aliases in every candidate query", async () => {
    const { db, queries } = createRecordingDb();

    await workspaceQueueRepo(db).uncheckedCardDifferences();
    await workspaceQueueRepo(db).newCardDrafts();
    await workspaceQueueRepo(db).newCandidatePrintings();
    await workspaceBatchRepo(db).trustedNewCardDrafts(["gallery"]);
    await workspaceBatchRepo(db).trustedNewPrintings(["gallery"]);
    await candidateMatchingRepo(db).listUncheckedCandidateCardsWithLive("usersubmission", null, 10);

    expect(queries).toHaveLength(6);
    for (const query of queries) {
      expect(query).toMatch(guarded);
    }
  });

  it("does not count an empty name as a new card", async () => {
    const { db, queries } = createRecordingDb();

    await workspaceQueueRepo(db).newCardDrafts();

    expect(queries[0]).toContain(`("cc"."norm_name" <> '' and not exists`);
  });

  it("resolves a single name with the same guard", async () => {
    const { db, queries, parameters } = createRecordingDb([[{ id: "card-1", slug: "fireball" }]]);

    const card = await cardSubmissionsRepo(db).liveCardByNormName("fireball");

    expect(card).toEqual({ id: "card-1", slug: "fireball" });
    expect(queries[0]).toMatch(/\$1 <> ''.*c\.norm_name = \$2.*card_name_aliases/su);
    expect(parameters[0]).toContain("fireball");
  });

  it("resolves names in bulk with the same guard", async () => {
    const { db, queries } = createRecordingDb();

    await candidateReviewRepo(db).cardSlugsByNormNames(["fireball"]);

    expect(queries[0]).toMatch(/"n"\."norm_name" <> ''.*card_name_aliases/su);
  });
});

describe("candidate comparison fragments", () => {
  it("compares linked printings the same way for the matching pass and the queue", async () => {
    const { db, queries } = createRecordingDb();

    await candidateMatchingRepo(db).listUncheckedCandidatePrintingsWithLive(
      "usersubmission",
      null,
      10,
    );
    await workspaceQueueRepo(db).uncheckedLinkedPrintings();

    for (const query of queries) {
      expect(query).toContain("'shortCode', cp.short_code");
      expect(query).toContain("'shortCode', p.short_code");
      expect(query).toContain("join lateral (\n  select f.* from faces f");
    }
  });
});

describe("candidateSideOrder", () => {
  const picksByLiveCard =
    /is not distinct from \(select live_card\.id from \(\s*select c\.id, c\.slug, c\.name from cards c/u;

  it("picks the side through the same live card lookup in every side picker", async () => {
    const { db, queries } = createRecordingDb();

    await workspaceQueueRepo(db).uncheckedLinkedPrintings();
    await candidateFingerprintsRepo(db).listPrintingsNeedingFingerprint(10);
    await printingImagesRepo(db).candidateFace("cp-1");

    expect(queries).toHaveLength(3);
    for (const query of queries) {
      expect(query).toMatch(picksByLiveCard);
      expect(query).not.toMatch(/a\.card_id = [fs]\.card_id/u);
    }
  });
});
