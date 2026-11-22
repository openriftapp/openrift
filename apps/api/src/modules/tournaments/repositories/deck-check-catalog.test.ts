import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { deckCheckCatalogRepo } from "./deck-check-catalog.js";

describe("canonicalPrintingByCard", () => {
  it("breaks canonical-rank ties by printing id, matching the stored line's read", async () => {
    const { db, queries } = createRecordingDb([
      [
        { printing_id: "p-1", card_id: "c-1" },
        { printing_id: "p-2", card_id: "c-1" },
      ],
    ]);

    const result = await deckCheckCatalogRepo(db).canonicalPrintingByCard(["c-1"]);

    expect(queries[0]).toMatch(/order by "canonical_rank" asc, "printing_id" asc/u);
    expect(result.get("c-1")).toBe("p-1");
  });
});
