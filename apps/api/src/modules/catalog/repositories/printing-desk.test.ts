import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { printingDeskRepo } from "./printing-desk.js";

describe("getFullPrintingForCard", () => {
  it("returns a side that shows the card", async () => {
    const row = { id: "p-1", cardId: "card-1" };
    const repo = printingDeskRepo(createMockDb([row]));
    await expect(repo.getFullPrintingForCard("p-1", "card-1")).resolves.toEqual(row);
  });

  it("returns nothing for a printing of another card", async () => {
    const repo = printingDeskRepo(createMockDb([{ id: "p-1", cardId: "card-other" }]));
    await expect(repo.getFullPrintingForCard("p-1", "card-1")).resolves.toBeUndefined();
  });
});
