import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { healthRoute } from "./public-health";

const mockHealthRepo = {
  healthCheck: vi.fn(() => Promise.resolve("ok" as string)),
};

const app = new Hono<{ Variables: Variables }>()
  .use("*", async (c, next) => {
    c.set("repos", { health: mockHealthRepo } as never);
    await next();
  })
  // Production mounts health unversioned at /api, not /api/v1.
  .route("/api", healthRoute);

describe("GET /api/health", () => {
  beforeEach(() => {
    mockHealthRepo.healthCheck.mockReset();
  });

  it.each([{ status: "ok" }, { status: "db_empty" }])(
    "returns 200 with status $status",
    async ({ status }) => {
      mockHealthRepo.healthCheck.mockResolvedValue(status);
      const res = await app.request("/api/health");
      expect(res.status).toBe(200);
      const json = await readJson(res);
      expect(json.status).toBe(status);
    },
  );

  it.each([{ status: "db_error" }, { status: "timeout" }])(
    "returns 503 with status $status",
    async ({ status }) => {
      mockHealthRepo.healthCheck.mockResolvedValue(status);
      const res = await app.request("/api/health");
      expect(res.status).toBe(503);
      const json = await readJson(res);
      expect(json.status).toBe(status);
    },
  );

  it("passes timeout constant to health check", async () => {
    mockHealthRepo.healthCheck.mockResolvedValue("ok");
    await app.request("/api/health");
    expect(mockHealthRepo.healthCheck).toHaveBeenCalledWith(5000);
  });

  it("calls healthCheck exactly once per request", async () => {
    mockHealthRepo.healthCheck.mockResolvedValue("ok");
    await app.request("/api/health");
    expect(mockHealthRepo.healthCheck).toHaveBeenCalledTimes(1);
  });
});
