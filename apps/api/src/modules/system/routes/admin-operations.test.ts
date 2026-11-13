import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { adminOperationsRouter } from "./admin-operations";

const mockMktAdmin = {
  clearPriceData: vi.fn(),
};

const mockMarketplace = { refreshLatestPrices: vi.fn() };

const mockCatalog = { refreshCatalogViews: vi.fn(), refreshCardAggregates: vi.fn() };

const mockCardTokens = { recomputeAll: vi.fn() };

const mockJobRuns = {
  start: vi.fn(async () => ({ id: "019d4999-4219-72f6-b7bb-64004e1b1bff" })),
  succeed: vi.fn(async () => undefined),
  fail: vi.fn(async () => undefined),
  getRunning: vi.fn<Repos["jobRuns"]["getRunning"]>(async () => null),
  listRecent: vi.fn(),
  getLatestPerKind: vi.fn(),
  sweepOrphaned: vi.fn(),
  purgeOlderThan: vi.fn(),
};

const mockAdminEvents = { insert: vi.fn() };

const USER_ID = "a0000000-0001-4000-a000-000000000001";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("repos", {
    marketplaceAdmin: mockMktAdmin,
    marketplace: mockMarketplace,
    catalog: mockCatalog,
    cardTokens: mockCardTokens,
    jobRuns: mockJobRuns,
    adminEvents: mockAdminEvents,
  } as never);
  await next();
});
registerRouterForTest(app, adminOperationsRouter);

describe("POST /api/admin/v1/clear-prices", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with deleted counts", async () => {
    mockMktAdmin.clearPriceData.mockResolvedValue({
      prices: 10,
      variants: 15,
      products: 20,
    });

    const res = await app.request("/api/admin/v1/clear-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplace: "tcgplayer" }),
    });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({
      marketplace: "tcgplayer",
      deleted: { prices: 10, variants: 15, products: 20 },
    });
    expect(mockMktAdmin.clearPriceData).toHaveBeenCalledWith("tcgplayer");
    expect(mockAdminEvents.insert).toHaveBeenCalledWith({
      actorUserId: USER_ID,
      action: "marketplace.clear-prices",
      entityType: "marketplace",
      entityId: "tcgplayer",
      newValues: { deleted: { prices: 10, variants: 15, products: 20 } },
    });
  });

  it("still reports the cleared rows when the audit write fails", async () => {
    mockMktAdmin.clearPriceData.mockResolvedValue({ prices: 3, variants: 2, products: 1 });
    mockAdminEvents.insert.mockRejectedValue(new Error("audit table locked"));

    const res = await app.request("/api/admin/v1/clear-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplace: "cardtrader" }),
    });

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({
      marketplace: "cardtrader",
      deleted: { prices: 3, variants: 2, products: 1 },
    });
    expect(mockMktAdmin.clearPriceData).toHaveBeenCalledWith("cardtrader");
  });

  it("works with cardmarket marketplace", async () => {
    mockMktAdmin.clearPriceData.mockResolvedValue({
      prices: 0,
      variants: 0,
      products: 0,
    });

    const res = await app.request("/api/admin/v1/clear-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplace: "cardmarket" }),
    });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.marketplace).toBe("cardmarket");
  });
});

function resetJobRunMocks() {
  mockJobRuns.start.mockImplementation(async () => ({
    id: "019d4999-4219-72f6-b7bb-64004e1b1bff",
  }));
  mockJobRuns.succeed.mockImplementation(async () => undefined);
  mockJobRuns.fail.mockImplementation(async () => undefined);
  mockJobRuns.getRunning.mockImplementation(async () => null);
}

describe("POST /api/admin/v1/refresh-materialized-views", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetJobRunMocks();
  });

  it("returns 202 with runId and refreshes the views in the background, without waiting on the caller's socket", async () => {
    mockMarketplace.refreshLatestPrices.mockResolvedValue(undefined);
    mockCatalog.refreshCatalogViews.mockResolvedValue(undefined);

    const res = await app.request("/api/admin/v1/refresh-materialized-views", {
      method: "POST",
    });
    expect(res.status).toBe(202);
    expect(await readJson(res)).toEqual({
      runId: "019d4999-4219-72f6-b7bb-64004e1b1bff",
      status: "running",
    });
    expect(mockJobRuns.start).toHaveBeenCalledWith({
      kind: "matviews.refresh",
      trigger: "admin",
    });

    await vi.waitFor(() => {
      expect(mockJobRuns.succeed).toHaveBeenCalled();
    });
    expect(mockMarketplace.refreshLatestPrices).toHaveBeenCalled();
    expect(mockCatalog.refreshCatalogViews).toHaveBeenCalled();
  });

  it("returns 'already_running' when a refresh is already in flight", async () => {
    mockJobRuns.getRunning.mockResolvedValueOnce({
      id: "019d4999-4219-72f6-b7bb-64004e1b1c00",
      startedAt: new Date(),
    });

    const res = await app.request("/api/admin/v1/refresh-materialized-views", {
      method: "POST",
    });
    expect(res.status).toBe(202);
    expect(await readJson(res)).toEqual({
      runId: "019d4999-4219-72f6-b7bb-64004e1b1c00",
      status: "already_running",
    });
    expect(mockMarketplace.refreshLatestPrices).not.toHaveBeenCalled();
    expect(mockJobRuns.start).not.toHaveBeenCalled();
  });

  it("writes a failed row when the background refresh throws", async () => {
    mockMarketplace.refreshLatestPrices.mockRejectedValue(new Error("deadlock detected"));
    mockCatalog.refreshCatalogViews.mockResolvedValue(undefined);

    const res = await app.request("/api/admin/v1/refresh-materialized-views", {
      method: "POST",
    });
    expect(res.status).toBe(202);

    await vi.waitFor(() => {
      expect(mockJobRuns.fail).toHaveBeenCalledWith(
        "019d4999-4219-72f6-b7bb-64004e1b1bff",
        expect.objectContaining({ errorMessage: "deadlock detected" }),
      );
    });
    expect(mockJobRuns.succeed).not.toHaveBeenCalled();
  });

  it("runs the refresh on the background repositories", async () => {
    const requestMarketplace = { refreshLatestPrices: vi.fn() };
    const backgroundApp = new Hono<{ Variables: Variables }>();
    backgroundApp.use("*", async (c, next) => {
      c.set("user", { id: USER_ID } as never);
      c.set("repos", { marketplace: requestMarketplace, jobRuns: mockJobRuns } as never);
      c.set("backgroundRepos", {
        marketplace: mockMarketplace,
        catalog: mockCatalog,
        jobRuns: mockJobRuns,
      } as never);
      await next();
    });
    registerRouterForTest(backgroundApp, adminOperationsRouter);
    mockMarketplace.refreshLatestPrices.mockResolvedValue(undefined);
    mockCatalog.refreshCatalogViews.mockResolvedValue(undefined);

    const res = await backgroundApp.request("/api/admin/v1/refresh-materialized-views", {
      method: "POST",
    });
    expect(res.status).toBe(202);
    await vi.waitFor(() => {
      expect(mockJobRuns.succeed).toHaveBeenCalled();
    });
    expect(mockMarketplace.refreshLatestPrices).toHaveBeenCalled();
    expect(requestMarketplace.refreshLatestPrices).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/v1/recompute-card-tokens", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetJobRunMocks();
  });

  it("returns 202 with runId and stores the counts as the run result", async () => {
    mockCardTokens.recomputeAll.mockResolvedValue({ totalCards: 500, withTokens: 42 });
    mockCatalog.refreshCardAggregates.mockResolvedValue(undefined);

    const res = await app.request("/api/admin/v1/recompute-card-tokens", {
      method: "POST",
    });
    expect(res.status).toBe(202);
    expect(await readJson(res)).toEqual({
      runId: "019d4999-4219-72f6-b7bb-64004e1b1bff",
      status: "running",
    });
    expect(mockJobRuns.start).toHaveBeenCalledWith({
      kind: "card_tokens.recompute",
      trigger: "admin",
    });

    await vi.waitFor(() => {
      expect(mockJobRuns.succeed).toHaveBeenCalledWith(
        "019d4999-4219-72f6-b7bb-64004e1b1bff",
        expect.objectContaining({ result: { totalCards: 500, withTokens: 42 } }),
      );
    });
    const recomputeOrder = mockCardTokens.recomputeAll.mock.invocationCallOrder[0];
    const refreshOrder = mockCatalog.refreshCardAggregates.mock.invocationCallOrder[0];
    expect(recomputeOrder).toBeLessThan(refreshOrder ?? 0);
  });

  it("returns 'already_running' when a recompute is already in flight", async () => {
    mockJobRuns.getRunning.mockResolvedValueOnce({
      id: "019d4999-4219-72f6-b7bb-64004e1b1c00",
      startedAt: new Date(),
    });

    const res = await app.request("/api/admin/v1/recompute-card-tokens", {
      method: "POST",
    });
    expect(res.status).toBe(202);
    expect(await readJson(res)).toEqual({
      runId: "019d4999-4219-72f6-b7bb-64004e1b1c00",
      status: "already_running",
    });
    expect(mockCardTokens.recomputeAll).not.toHaveBeenCalled();
  });
});
