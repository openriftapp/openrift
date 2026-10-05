import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { scanRouter } from "./public-scan";

const mockScanIndex = {
  get: vi.fn(),
};

const mockConfig = {
  scan: {
    encoderFile: "scan-encoder-v2.onnx",
    detectorFile: null as string | null,
    boardDetectorFile: null as string | null,
  },
};

const GENERATION = {
  formatVersion: 1,
  bankHash: "511b47521ffca52a",
  entryCount: 2670,
  encoderTag: "scan-encoder-v2.onnx",
  watermark: new Date("2026-07-28T10:00:00.000Z"),
  builtAt: new Date("2026-07-28T11:36:00.000Z"),
  durationMs: 60_151,
};

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("config", mockConfig as never);
  c.set("repos", { scanIndex: mockScanIndex } as never);
  await next();
});
registerRouterForTest(app, scanRouter);

describe("GET /api/v1/scan/manifest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockConfig.scan.detectorFile = null;
    mockConfig.scan.boardDetectorFile = null;
  });

  it("reports unavailable with only the engine assets before any bank exists", async () => {
    mockScanIndex.get.mockResolvedValue(null);

    const res = await app.request("/api/v1/scan/manifest");
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({
      available: false,
      formatVersion: null,
      bankHash: null,
      entryCount: null,
      builtAt: null,
      bankUrl: null,
      labelsUrl: null,
      encoderUrl: "/media/scan/scan-encoder-v2.onnx",
      detectorUrl: null,
      boardDetectorUrl: null,
    });
  });

  it("hands out the current generation's content-hashed URLs", async () => {
    mockScanIndex.get.mockResolvedValue(GENERATION);
    mockConfig.scan.detectorFile = "scan-detector-v1.onnx";

    const res = await app.request("/api/v1/scan/manifest");
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({
      available: true,
      formatVersion: 1,
      bankHash: "511b47521ffca52a",
      entryCount: 2670,
      builtAt: "2026-07-28T11:36:00.000Z",
      bankUrl: "/media/scan/scan-bank-511b47521ffca52a.bin",
      labelsUrl: "/media/scan/scan-labels-511b47521ffca52a.json",
      encoderUrl: "/media/scan/scan-encoder-v2.onnx",
      detectorUrl: "/media/scan/scan-detector-v1.onnx",
      boardDetectorUrl: null,
    });
  });

  it("reports unavailable while no card detector is deployed", async () => {
    mockScanIndex.get.mockResolvedValue(GENERATION);

    const res = await app.request("/api/v1/scan/manifest");
    expect(await readJson(res)).toMatchObject({
      available: false,
      bankUrl: "/media/scan/scan-bank-511b47521ffca52a.bin",
      detectorUrl: null,
    });
  });

  it("names the board detector when one is deployed", async () => {
    mockScanIndex.get.mockResolvedValue(null);
    mockConfig.scan.boardDetectorFile = "scan-board-detector-v1.onnx";

    const res = await app.request("/api/v1/scan/manifest");
    expect(await readJson(res)).toMatchObject({
      boardDetectorUrl: "/media/scan/scan-board-detector-v1.onnx",
    });
  });

  it("names the card detector when one is deployed", async () => {
    mockScanIndex.get.mockResolvedValue(null);
    mockConfig.scan.detectorFile = "scan-detector-v1.onnx";

    const res = await app.request("/api/v1/scan/manifest");
    expect(await readJson(res)).toMatchObject({ detectorUrl: "/media/scan/scan-detector-v1.onnx" });
  });
});
