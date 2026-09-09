import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { cardmarketOverlayRouter } from "./authenticated-cardmarket-overlay";

interface CountRow {
  idProduct: number;
  finish: "normal" | "foil";
  owned: number;
  wanted: number;
  priceCents: number | null;
}

interface ListRow {
  id: string;
  name: string;
  kind: "card" | "printing";
}

const mockOverlayRepo = {
  wishListsForUser: vi.fn(() => Promise.resolve([] as ListRow[])),
  productCounts: vi.fn(() => Promise.resolve([] as CountRow[])),
};

const mockListsRepo = {
  entriesWithDetails: vi.fn(() => Promise.resolve([] as object[])),
};

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const LIST_ID = "a0000000-0001-4000-a000-000000000010";
const OTHER_LIST_ID = "a0000000-0001-4000-a000-000000000011";

const CARD_ID = "c0000000-0001-4000-a000-000000000001";
const PRINTING_ID = "d0000000-0001-4000-a000-000000000001";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("repos", { cardmarketOverlay: mockOverlayRepo, lists: mockListsRepo } as never);
  await next();
});
registerRouterForTest(app, cardmarketOverlayRouter);

function snapshot(listIds: string[], marketplace = "cardmarket") {
  return app.request("/api/v1/cardmarket/overlay/snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listIds, marketplace }),
  });
}

describe("POST /api/v1/cardmarket/overlay/snapshot", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the resolved lists, the marketplace and the product counts", async () => {
    mockOverlayRepo.wishListsForUser.mockResolvedValue([
      { id: OTHER_LIST_ID, name: "Skirmish Wants", kind: "card" },
      { id: LIST_ID, name: "Summoner Wants", kind: "printing" },
    ]);
    mockOverlayRepo.productCounts.mockResolvedValue([
      { idProduct: 914_101, finish: "normal", owned: 3, wanted: 2, priceCents: 1250 },
      { idProduct: 914_102, finish: "foil", owned: 0, wanted: 1, priceCents: null },
    ]);

    const res = await snapshot([LIST_ID, OTHER_LIST_ID]);

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.lists).toEqual([
      { id: OTHER_LIST_ID, name: "Skirmish Wants" },
      { id: LIST_ID, name: "Summoner Wants" },
    ]);
    expect(json.marketplace).toBe("cardmarket");
    expect(json.products).toEqual([
      { idProduct: 914_101, finish: "normal", owned: 3, wanted: 2, priceCents: 1250 },
      { idProduct: 914_102, finish: "foil", owned: 0, wanted: 1, priceCents: null },
    ]);
    expect(Number.isNaN(Date.parse(json.generatedAt as string))).toBe(false);
  });

  it("passes a price-only row through with both counts at zero", async () => {
    mockOverlayRepo.wishListsForUser.mockResolvedValue([
      { id: LIST_ID, name: "Summoner Wants", kind: "printing" },
    ]);
    mockOverlayRepo.productCounts.mockResolvedValue([
      { idProduct: 914_101, finish: "normal", owned: 0, wanted: 0, priceCents: 400 },
    ]);

    const res = await snapshot([LIST_ID]);

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.products).toEqual([
      { idProduct: 914_101, finish: "normal", owned: 0, wanted: 0, priceCents: 400 },
    ]);
  });

  it("passes both finishes of one product id through as separate rows", async () => {
    mockOverlayRepo.wishListsForUser.mockResolvedValue([
      { id: LIST_ID, name: "Summoner Wants", kind: "printing" },
    ]);
    mockOverlayRepo.productCounts.mockResolvedValue([
      { idProduct: 914_101, finish: "foil", owned: 1, wanted: 4, priceCents: 900 },
      { idProduct: 914_101, finish: "normal", owned: 3, wanted: 2, priceCents: 250 },
    ]);

    const res = await snapshot([LIST_ID]);

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.products).toEqual([
      { idProduct: 914_101, finish: "foil", owned: 1, wanted: 4, priceCents: 900 },
      { idProduct: 914_101, finish: "normal", owned: 3, wanted: 2, priceCents: 250 },
    ]);
  });

  it("counts a repeated list id once and forwards the requested marketplace", async () => {
    mockOverlayRepo.wishListsForUser.mockResolvedValue([
      { id: LIST_ID, name: "Summoner Wants", kind: "printing" },
    ]);
    mockOverlayRepo.productCounts.mockResolvedValue([]);

    const res = await snapshot([LIST_ID, LIST_ID], "tcgplayer");

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.marketplace).toBe("tcgplayer");
    expect(mockOverlayRepo.wishListsForUser).toHaveBeenCalledWith([LIST_ID], USER_ID);
    expect(mockListsRepo.entriesWithDetails).toHaveBeenCalledTimes(1);
    expect(mockOverlayRepo.productCounts).toHaveBeenCalledWith([], USER_ID, "tcgplayer");
  });

  it("resolves each list through its own kind and flattens the wants", async () => {
    mockOverlayRepo.wishListsForUser.mockResolvedValue([
      { id: OTHER_LIST_ID, name: "Playset", kind: "card" },
      { id: LIST_ID, name: "Summoner Wants", kind: "printing" },
    ]);
    mockListsRepo.entriesWithDetails
      // The rule-driven list: no list_entries row, a rule-only row with netOwned applied.
      .mockResolvedValueOnce([
        { kind: "card", id: null, source: "rule", cardId: CARD_ID, quantity: 2 },
      ])
      .mockResolvedValueOnce([
        { kind: "printing", id: "le-1", source: "manual", printingId: PRINTING_ID, quantity: 3 },
      ]);
    mockOverlayRepo.productCounts.mockResolvedValue([]);

    const res = await snapshot([LIST_ID, OTHER_LIST_ID]);

    expect(res.status).toBe(200);
    expect(mockListsRepo.entriesWithDetails).toHaveBeenNthCalledWith(
      1,
      OTHER_LIST_ID,
      "card",
      USER_ID,
    );
    expect(mockListsRepo.entriesWithDetails).toHaveBeenNthCalledWith(
      2,
      LIST_ID,
      "printing",
      USER_ID,
    );
    expect(mockOverlayRepo.productCounts).toHaveBeenCalledWith(
      [
        { cardId: CARD_ID, printingId: null, quantity: 2 },
        { cardId: null, printingId: PRINTING_ID, quantity: 3 },
      ],
      USER_ID,
      "cardmarket",
    );
  });

  it("returns 404 when one id of several does not resolve", async () => {
    mockOverlayRepo.wishListsForUser.mockResolvedValue([
      { id: LIST_ID, name: "Summoner Wants", kind: "printing" },
    ]);

    const res = await snapshot([LIST_ID, OTHER_LIST_ID]);

    expect(res.status).toBe(404);
    const json = await readJson(res);
    expect(json.message).toContain("not found");
    expect(mockListsRepo.entriesWithDetails).not.toHaveBeenCalled();
    expect(mockOverlayRepo.productCounts).not.toHaveBeenCalled();
  });

  it("rejects an empty list, a non-uuid id and an unknown marketplace", async () => {
    const emptyList = await snapshot([]);
    const badId = await snapshot(["not-a-uuid"]);
    const badMarketplace = await snapshot([LIST_ID], "ebay");
    expect(emptyList.status).toBe(400);
    expect(badId.status).toBe(400);
    expect(badMarketplace.status).toBe(400);
    expect(mockOverlayRepo.wishListsForUser).not.toHaveBeenCalled();
  });

  it("rejects more ids than the contract allows", async () => {
    const tooMany = Array.from(
      { length: 51 },
      (_, index) => `a0000000-0001-4000-a000-${String(index).padStart(12, "0")}`,
    );

    const res = await snapshot(tooMany);
    expect(res.status).toBe(400);
    expect(mockOverlayRepo.wishListsForUser).not.toHaveBeenCalled();
  });
});
