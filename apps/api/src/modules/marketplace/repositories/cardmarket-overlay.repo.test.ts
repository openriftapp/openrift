import { describe, expect, it } from "vitest";

import { createMockDb } from "../../../test/mock-db.js";
import { cardmarketOverlayRepo } from "./cardmarket-overlay.js";

describe("cardmarketOverlayRepo", () => {
  it("wishListsForUser returns the rows", async () => {
    const rows = [
      { id: "lst-1", name: "Summoner Wants", kind: "printing" },
      { id: "lst-2", name: "Skirmish Wants", kind: "card" },
    ];
    const db = createMockDb(rows);
    const repo = cardmarketOverlayRepo(db);
    expect(await repo.wishListsForUser(["lst-1", "lst-2"], "u1")).toEqual(rows);
  });

  it("wishListsForUser returns an empty array when nothing matches", async () => {
    const db = createMockDb([]);
    const repo = cardmarketOverlayRepo(db);
    expect(await repo.wishListsForUser(["lst-1"], "u1")).toEqual([]);
  });

  it("productCounts returns the aggregated rows", async () => {
    const rows = [
      { idProduct: 914_101, finish: "normal", owned: 3, wanted: 2, priceCents: 1250 },
      { idProduct: 914_101, finish: "foil", owned: 0, wanted: 1, priceCents: null },
      { idProduct: 914_102, finish: "normal", owned: 0, wanted: 0, priceCents: 400 },
    ];
    const db = createMockDb(rows);
    const repo = cardmarketOverlayRepo(db);
    const wants = [
      { cardId: "card-1", printingId: null, quantity: 2 },
      { cardId: null, printingId: "pr-1", quantity: 3 },
    ];
    expect(await repo.productCounts(wants, "u1", "cardmarket")).toEqual(rows);
  });

  it("productCounts runs with no wants at all", async () => {
    const db = createMockDb([]);
    const repo = cardmarketOverlayRepo(db);
    expect(await repo.productCounts([], "u1", "cardmarket")).toEqual([]);
  });
});
