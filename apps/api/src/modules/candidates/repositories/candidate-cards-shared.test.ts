import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { printingImagesRepo } from "../../catalog/repositories/printing-images.js";
import { candidateCardDetailRepo } from "./candidate-cards-detail.js";
import { candidateFingerprintsRepo } from "./candidate-cards-fingerprints.js";
import { workspaceQueueRepo } from "./workspace-queue.js";

describe("card name lookups", () => {
  it("matches nothing for an empty name without querying", async () => {
    const { db, queries } = createRecordingDb([]);
    const repo = candidateCardDetailRepo(db);

    await expect(repo.candidateCardsByNormName("")).resolves.toEqual([]);
    await expect(repo.candidateProvidersForNormName("")).resolves.toEqual([]);
    expect(queries).toEqual([]);
  });
});

describe("candidateSideOrder", () => {
  const picksByLiveCard =
    /is not distinct from \(select live_card\.id from \(\s*select m\.id, m\.slug, m\.name from \(\s*select c\.id, c\.slug, c\.name/u;

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
