import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { siteSettingsRouter } from "./public-site-settings";

const mockSiteSettingsRepo = {
  listByScope: vi.fn(() => Promise.resolve([] as { key: string; value: string }[])),
};

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("repos", { siteSettings: mockSiteSettingsRepo } as any);
  await next();
});
registerRouterForTest(app, siteSettingsRouter);

describe("GET /api/v1/site-settings", () => {
  it("returns empty items when no settings exist", async () => {
    const res = await app.request("/api/v1/site-settings");
    const json = await readJson(res);
    expect(json.settings).toEqual({});
  });
});
