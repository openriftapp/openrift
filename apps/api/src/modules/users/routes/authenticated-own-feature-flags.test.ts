import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { ownFeatureFlagsRouter } from "./authenticated-own-feature-flags";

const mockRepo = {
  upsert: vi.fn(() => Promise.resolve(undefined)),
  listMerged: vi.fn(() => Promise.resolve({} as Record<string, boolean>)),
};

const mockFlagsRepo = {
  create: vi.fn(() => Promise.resolve(undefined)),
};

const USER_ID = "a0000000-0001-4000-a000-000000000001";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  // oxlint-disable-next-line no-explicit-any -- test stub doesn't match full types
  c.set("user", { id: USER_ID } as any);
  // oxlint-disable-next-line no-explicit-any -- test mock doesn't match full Repos type
  c.set("repos", { userFeatureFlags: mockRepo, featureFlags: mockFlagsRepo } as any);
  await next();
});
registerRouterForTest(app, ownFeatureFlagsRouter);

function put(body: unknown) {
  return app.request("/api/v1/feature-flags/self", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/v1/feature-flags/self", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores an override when the user opts in", async () => {
    mockRepo.listMerged.mockResolvedValue({ "deck-builder-beta": true });
    const res = await put({ key: "deck-builder-beta", enabled: true });
    expect(res.status).toBe(200);
    expect(mockFlagsRepo.create).toHaveBeenCalledWith({
      key: "deck-builder-beta",
      enabled: false,
      description: null,
    });
    expect(mockRepo.upsert).toHaveBeenCalledWith(USER_ID, "deck-builder-beta", true);
    expect(await readJson(res)).toEqual({ flags: { "deck-builder-beta": true } });
  });

  it("stores a false override when the user opts out", async () => {
    const res = await put({ key: "deck-builder-beta", enabled: false });
    expect(res.status).toBe(200);
    expect(mockFlagsRepo.create).toHaveBeenCalled();
    expect(mockRepo.upsert).toHaveBeenCalledWith(USER_ID, "deck-builder-beta", false);
  });

  it("rejects an anonymous request", async () => {
    const anonymous = new Hono<{ Variables: Variables }>();
    anonymous.use("*", async (c, next) => {
      c.set("auth", { api: { getSession: () => Promise.resolve(null) } } as never);
      // oxlint-disable-next-line no-explicit-any -- test mock doesn't match full Repos type
      c.set("repos", { userFeatureFlags: mockRepo, featureFlags: mockFlagsRepo } as any);
      await next();
    });
    registerRouterForTest(anonymous, ownFeatureFlagsRouter);
    const res = await anonymous.request("/api/v1/feature-flags/self", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "deck-builder-beta", enabled: true }),
    });
    expect(res.status).toBe(401);
    expect(mockRepo.upsert).not.toHaveBeenCalled();
  });

  it("rejects a flag that is not self-service", async () => {
    const res = await put({ key: "catalog-workspace", enabled: true });
    expect(res.status).toBe(400);
    expect(mockRepo.upsert).not.toHaveBeenCalled();
  });
});
