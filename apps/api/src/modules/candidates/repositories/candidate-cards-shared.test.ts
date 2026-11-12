import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { candidateCardDetailRepo } from "./candidate-cards-detail.js";
import { workspaceBatchRepo } from "./workspace-batch.js";

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
