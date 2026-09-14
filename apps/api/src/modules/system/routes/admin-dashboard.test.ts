import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { adminDashboardRouter } from "./admin-dashboard";

const mockStatus = { getAppStats: vi.fn(), getGrowthSeries: vi.fn() };

const USER_ID = "a0000000-0001-4000-a000-000000000001";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("repos", { status: mockStatus } as never);
  await next();
});
registerRouterForTest(app, adminDashboardRouter);

const appStats = {
  totalUsers: 100,
  recentSignups7d: 5,
  totalCards: 312,
  totalPrintings: 468,
  totalSets: 4,
  totalCollections: 80,
  totalUserDecks: 25,
  totalMetaDecks: 12,
  totalWishlists: 9,
  totalTradelists: 6,
  totalFriendGroups: 3,
  totalCopies: 142,
};

const users = [
  { date: "2026-09-01", count: 3 },
  { date: "2026-09-02", count: 0 },
  { date: "2026-09-03", count: 7 },
];

const emptyGrowth = {
  users: [],
  collections: [],
  userDecks: [],
  metaDecks: [],
  wishlists: [],
  tradelists: [],
  friendGroups: [],
};

const growth = { ...emptyGrowth, users, wishlists: [{ date: "2026-09-03", count: 1 }] };

describe("GET /dashboard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStatus.getAppStats.mockResolvedValue(appStats);
    mockStatus.getGrowthSeries.mockResolvedValue(growth);
  });

  it("returns the app totals alongside the growth series", async () => {
    const res = await app.request("/api/admin/v1/dashboard");
    expect(res.status).toBe(200);

    const json = await readJson(res);
    expect(json.app).toEqual(appStats);
    expect(json.growth).toEqual(growth);
  });

  it("returns empty series when nothing has been created yet", async () => {
    mockStatus.getGrowthSeries.mockResolvedValue(emptyGrowth);

    const res = await app.request("/api/admin/v1/dashboard");
    expect(res.status).toBe(200);

    const json = await readJson(res);
    expect(json.growth).toEqual(emptyGrowth);
  });
});
