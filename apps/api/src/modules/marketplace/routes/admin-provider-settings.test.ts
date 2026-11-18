import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { adminProviderSettingsRouter } from "./admin-provider-settings";

const mockRepo = {
  listAll: vi.fn(),
  upsert: vi.fn(),
};

const mockAdminEvents = { insert: vi.fn() };

const USER_ID = "a0000000-0001-4000-a000-000000000001";

// Mount the oRPC router directly (without the requireAdmin gate). AppErrors are
// bridged to ORPCErrors inside the router, so 4xx responses carry `{ message }`.
const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("repos", { providerSettings: mockRepo, adminEvents: mockAdminEvents } as never);
  await next();
});
registerRouterForTest(app, adminProviderSettingsRouter);

const dbSetting1 = {
  provider: "tcgplayer",
  sortOrder: 0,
  isHidden: false,
  isFavorite: false,
  isHelperReviewable: false,
};

const dbSetting2 = {
  provider: "cardmarket",
  sortOrder: 1,
  isHidden: true,
  isFavorite: true,
  isHelperReviewable: true,
};

describe("GET /provider-settings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with serialized provider settings", async () => {
    mockRepo.listAll.mockResolvedValue([dbSetting1, dbSetting2]);
    const res = await app.request("/api/admin/v1/provider-settings");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.providerSettings).toHaveLength(2);
    expect(json.providerSettings[0]).toEqual({
      provider: "tcgplayer",
      sortOrder: 0,
      isHidden: false,
      isFavorite: false,
      helperReviewable: false,
    });
    expect(json.providerSettings[1]).toEqual({
      provider: "cardmarket",
      sortOrder: 1,
      isHidden: true,
      isFavorite: true,
      helperReviewable: true,
    });
  });

  it("returns empty array when no provider settings exist", async () => {
    mockRepo.listAll.mockResolvedValue([]);
    const res = await app.request("/api/admin/v1/provider-settings");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.providerSettings).toEqual([]);
  });
});

describe("PATCH /provider-settings/:provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRepo.listAll.mockResolvedValue([dbSetting1, dbSetting2]);
  });

  it("records the previous and new value of each changed setting", async () => {
    mockRepo.upsert.mockResolvedValue(undefined);
    await app.request("/api/admin/v1/provider-settings/tcgplayer", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: true, sortOrder: 0 }),
    });
    expect(mockAdminEvents.insert).toHaveBeenCalledWith({
      actorUserId: USER_ID,
      action: "provider-setting.update",
      entityType: "provider-setting",
      entityId: "tcgplayer",
      oldValues: { isHidden: false },
      newValues: { isHidden: true },
    });
  });

  it("returns 204 when updating helperReviewable", async () => {
    mockRepo.upsert.mockResolvedValue(undefined);
    const res = await app.request("/api/admin/v1/provider-settings/gallery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ helperReviewable: true }),
    });
    expect(res.status).toBe(204);
    expect(mockRepo.upsert).toHaveBeenCalledWith("gallery", { helperReviewable: true });
  });
});
