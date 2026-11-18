import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { adminSiteSettingsRouter } from "./admin-site-settings";

const mockRepo = {
  listAll: vi.fn(),
};

const USER_ID = "a0000000-0001-4000-a000-000000000001";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("repos", { siteSettings: mockRepo } as never);
  await next();
});
registerRouterForTest(app, adminSiteSettingsRouter);

const now = new Date("2026-03-17T00:00:00Z");

const dbSetting1 = {
  key: "umami-url",
  value: "https://analytics.example.com",
  scope: "web",
  createdAt: now,
  updatedAt: now,
};

const dbSetting2 = {
  key: "rate-limit",
  value: "100",
  scope: "api",
  createdAt: now,
  updatedAt: now,
};

describe("GET /api/admin/v1/site-settings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with serialized site settings", async () => {
    mockRepo.listAll.mockResolvedValue([dbSetting1, dbSetting2]);
    const res = await app.request("/api/admin/v1/site-settings");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.settings).toHaveLength(2);
    expect(json.settings[0]).toEqual({
      key: "umami-url",
      value: "https://analytics.example.com",
      scope: "web",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    expect(json.settings[1]).toEqual({
      key: "rate-limit",
      value: "100",
      scope: "api",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });
});
