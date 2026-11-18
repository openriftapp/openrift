import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { keywordsRepo } from "./keywords.js";

describe("keywordsRepo", () => {
  it("listAll returns the mocked result", async () => {
    const rows = [{ id: "1", name: "Bold", cssClass: "bold" }];
    const db = createMockDb(rows);
    const repo = keywordsRepo(db);
    const result = await repo.listAll();
    expect(result).toEqual(rows);
  });

  it("recomputeAll reports how many cards it scanned and updated", async () => {
    // One card whose stored keywords ([] via the mock's shared result) differ
    // from the derived set, so it counts as updated.
    const db = createMockDb([{ id: "c-1", keywords: ["shield"], cardId: "c-1" }]);
    expect(await keywordsRepo(db).recomputeAll()).toEqual({ totalCards: 1, updated: 1 });
  });
});
