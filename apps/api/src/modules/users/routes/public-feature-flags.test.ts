import { Hono } from "hono";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { featureFlagsRouter } from "./public-feature-flags";

const mockFeatureFlagsRepo = {
  listKeyEnabled: vi.fn(() => Promise.resolve([] as { key: string; enabled: boolean }[])),
};

const mockScanIndex = {
  get: vi.fn(),
};

const mockConfig = {
  scan: { detectorFile: null as string | null },
};

function buildApp() {
  const app = new Hono<{ Variables: Variables }>();
  app.use("*", async (c, next) => {
    // oxlint-disable-next-line no-explicit-any -- test stub doesn't match full Repos/Auth
    c.set("repos", { featureFlags: mockFeatureFlagsRepo, scanIndex: mockScanIndex } as any);
    c.set("config", mockConfig as never);
    // oxlint-disable-next-line no-explicit-any -- minimal auth stub: no session
    c.set("auth", { api: { getSession: () => Promise.resolve(null) } } as any);
    await next();
  });
  registerRouterForTest(app, featureFlagsRouter);
  return app;
}

const app = buildApp();

describe("GET /api/v1/feature-flags", () => {
  beforeEach(() => {
    mockFeatureFlagsRepo.listKeyEnabled.mockReset();
    mockScanIndex.get.mockReset();
    mockScanIndex.get.mockResolvedValue(null);
    mockConfig.scan.detectorFile = null;
  });

  it("returns 200 with key→enabled map", async () => {
    mockFeatureFlagsRepo.listKeyEnabled.mockResolvedValue([
      { key: "dark-mode", enabled: true },
      { key: "beta-search", enabled: false },
    ]);

    const res = await app.request("/api/v1/feature-flags");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ flags: { "dark-mode": true, "beta-search": false, scanner: false } });
  });

  it("returns only the scanner flag when no flags exist", async () => {
    mockFeatureFlagsRepo.listKeyEnabled.mockResolvedValue([]);

    const res = await app.request("/api/v1/feature-flags");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ flags: { scanner: false } });
  });

  it("turns the scanner on once a bank is built and the detector is configured", async () => {
    mockFeatureFlagsRepo.listKeyEnabled.mockResolvedValue([]);
    mockScanIndex.get.mockResolvedValue({ bankHash: "511b47521ffca52a" });
    mockConfig.scan.detectorFile = "scan-detector-v2.onnx";

    const json = await readJson(await app.request("/api/v1/feature-flags"));
    expect(json.flags.scanner).toBe(true);
  });

  it("overrides a stored flag that shares the scanner key", async () => {
    mockFeatureFlagsRepo.listKeyEnabled.mockResolvedValue([{ key: "scanner", enabled: true }]);

    const json = await readJson(await app.request("/api/v1/feature-flags"));
    expect(json.flags.scanner).toBe(false);
  });

  it("returns multiple flags correctly", async () => {
    mockFeatureFlagsRepo.listKeyEnabled.mockResolvedValue([
      { key: "a", enabled: true },
      { key: "b", enabled: true },
      { key: "c", enabled: false },
    ]);

    const res = await app.request("/api/v1/feature-flags");
    const json = await readJson(res);
    expect(Object.keys(json.flags)).toHaveLength(4);
    expect(json.flags.a).toBe(true);
    expect(json.flags.c).toBe(false);
  });
});
