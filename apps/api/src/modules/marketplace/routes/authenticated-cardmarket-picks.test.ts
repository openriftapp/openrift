import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import type { CardmarketProductPrintingRow } from "../repositories/cardmarket-stock.js";
import { cardmarketPicksRouter } from "./authenticated-cardmarket-picks";

const mockStockRepo = {
  productPrintings: vi.fn(() => Promise.resolve([] as CardmarketProductPrintingRow[])),
};

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const PRINTING_EN = "d0000000-0001-4000-a000-000000000001";
const PRINTING_FR = "d0000000-0001-4000-a000-000000000002";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("repos", { cardmarketStock: mockStockRepo } as never);
  await next();
});
registerRouterForTest(app, cardmarketPicksRouter);

function resolve(rows: unknown) {
  return app.request("/api/v1/cardmarket/picks/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
}

describe("POST /api/v1/cardmarket/picks/resolve", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("resolves each pick to the printing in its language, in input order", async () => {
    mockStockRepo.productPrintings.mockResolvedValue([
      {
        externalId: 904_070,
        finish: "normal",
        productName: "Ambessa, The Wolf",
        printingId: PRINTING_EN,
        language: "EN",
      },
      {
        externalId: 904_070,
        finish: "normal",
        productName: "Ambessa, The Wolf",
        printingId: PRINTING_FR,
        language: "FR",
      },
    ]);

    const res = await resolve([
      { idProduct: 904_070, isFoil: false, idLanguage: 2 },
      { idProduct: 904_070, isFoil: false, idLanguage: 1 },
      { idProduct: 904_070, isFoil: false, idLanguage: 0 },
      { idProduct: 1, isFoil: true, idLanguage: 1 },
    ]);

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.rows).toEqual([
      {
        idProduct: 904_070,
        isFoil: false,
        idLanguage: 2,
        printingId: PRINTING_FR,
        reason: null,
        productName: "Ambessa, The Wolf",
        languageName: "French",
      },
      {
        idProduct: 904_070,
        isFoil: false,
        idLanguage: 1,
        printingId: PRINTING_EN,
        reason: null,
        productName: "Ambessa, The Wolf",
        languageName: "English",
      },
      {
        idProduct: 904_070,
        isFoil: false,
        idLanguage: 0,
        printingId: null,
        reason: "language-not-printed",
        productName: "Ambessa, The Wolf",
        languageName: null,
      },
      {
        idProduct: 1,
        isFoil: true,
        idLanguage: 1,
        printingId: null,
        reason: "unknown-product",
        productName: null,
        languageName: "English",
      },
    ]);
    expect(mockStockRepo.productPrintings).toHaveBeenCalledWith([904_070, 904_070, 904_070, 1]);
  });

  it("rejects an empty pick list", async () => {
    const res = await resolve([]);

    expect(res.status).toBe(400);
    expect(mockStockRepo.productPrintings).not.toHaveBeenCalled();
  });
});
