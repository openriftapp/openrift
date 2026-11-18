import { JOB_KIND } from "@openrift/shared/job-run-kinds";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { rehostImages, runRegenerateImagesJob, refetchImages } from "../services/images/jobs.js";
import { adminImagesRouter } from "./admin-images";

const RUN_TEST = "019d4999-4219-72f6-b7bb-640000000001";
const EARLIER_RUN = "019d4999-4219-72f6-b7bb-640000000002";
const RUN_X = "019d4999-4219-72f6-b7bb-640000000003";

vi.mock("../services/images/jobs.js", async (importActual) => {
  const actual = (await importActual()) as Record<string, unknown>;
  return {
    ...actual,
    rehostImages: vi.fn(),
    runRegenerateImagesJob: vi.fn(),
    refetchImages: vi.fn(),
  };
});

const mockRehostImages = vi.mocked(rehostImages);
const mockRunRegenerateImagesJob = vi.mocked(runRegenerateImagesJob);
const mockRefetchImages = vi.mocked(refetchImages);

const mockPrintingImages = {};

const mockJobRuns = {
  start: vi.fn(async () => ({ id: RUN_TEST })),
  succeed: vi.fn(),
  fail: vi.fn(),
  getRunning: vi.fn<Repos["jobRuns"]["getRunning"]>(async () => null),
  getLatestForResume: vi.fn<Repos["jobRuns"]["getLatestForResume"]>(async () => null),
  getResult: vi.fn(),
  updateResult: vi.fn(),
  requestCancel: vi.fn(),
  listRecent: vi.fn(),
  getLatestPerKind: vi.fn(),
  sweepOrphaned: vi.fn(),
  purgeOlderThan: vi.fn(),
};

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const mockIo = { fetch: vi.fn() };

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("io", mockIo as never);
  c.set("repos", {
    printingImages: mockPrintingImages,
    jobRuns: mockJobRuns,
  } as never);
  await next();
});
registerRouterForTest(app, adminImagesRouter);

describe("POST /api/admin/v1/rehost-images", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with rehost result using default limit", async () => {
    const result = { total: 10, rehosted: 8, skipped: 1, failed: 1, errors: ["err1"] };
    mockRehostImages.mockResolvedValue(result);

    const res = await app.request("/api/admin/v1/rehost-images", { method: "POST" });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual(result);
    expect(mockRehostImages).toHaveBeenCalledWith(mockIo, mockPrintingImages, 10);
  });

  it("passes custom limit from query param", async () => {
    const result = { total: 5, rehosted: 5, skipped: 0, failed: 0, errors: [] };
    mockRehostImages.mockResolvedValue(result);

    const res = await app.request("/api/admin/v1/rehost-images?limit=25", { method: "POST" });
    expect(res.status).toBe(200);
    expect(mockRehostImages).toHaveBeenCalledWith(mockIo, mockPrintingImages, 25);
  });
});

describe("POST /api/admin/v1/regenerate-images", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockJobRuns.start.mockResolvedValue({ id: RUN_TEST });
    mockJobRuns.getRunning.mockResolvedValue(null);
    mockJobRuns.getLatestForResume.mockResolvedValue(null);
    mockRunRegenerateImagesJob.mockResolvedValue({
      snapshot: [],
      totalFiles: 0,
      lastProcessedIndex: -1,
      processed: 0,
      regenerated: 0,
      failed: 0,
      errors: [],
      resumedFromRunId: null,
      cancelRequested: false,
      skipExisting: false,
    });
  });

  it("kicks off a fresh job and returns runId immediately", async () => {
    const res = await app.request("/api/admin/v1/regenerate-images", { method: "POST" });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ runId: RUN_TEST, status: "running" });
    expect(mockJobRuns.start).toHaveBeenCalledWith({
      kind: JOB_KIND.regenerateImages,
      trigger: "admin",
    });
    expect(mockJobRuns.getLatestForResume).toHaveBeenCalledWith(JOB_KIND.regenerateImages);
  });

  it("returns already_running when a regenerate job is already in flight", async () => {
    mockJobRuns.getRunning.mockResolvedValue({ id: EARLIER_RUN, lastSeenAt: new Date() });
    const res = await app.request("/api/admin/v1/regenerate-images", { method: "POST" });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ runId: EARLIER_RUN, status: "already_running" });
    expect(mockJobRuns.start).not.toHaveBeenCalled();
  });

  it("does NOT pass resumeFrom when ?reset=true is present, even if a failed prior run exists", async () => {
    mockJobRuns.getLatestForResume.mockResolvedValue({
      id: "prior-failed",
      kind: JOB_KIND.regenerateImages,
      trigger: "admin",
      status: "failed",
      startedAt: new Date(),
      finishedAt: new Date(),
      durationMs: 1,
      errorMessage: "boom",
      noop: null,
      result: {
        snapshot: [{ imageId: "card-1", rehostedUrl: "/m/01/card-1" }],
        totalFiles: 5,
        lastProcessedIndex: 1,
        processed: 2,
        regenerated: 2,
        failed: 0,
        errors: [],
        resumedFromRunId: null,
        cancelRequested: false,
        skipExisting: false,
      },
    });

    const res = await app.request("/api/admin/v1/regenerate-images?reset=true", { method: "POST" });
    expect(res.status).toBe(200);
    expect(mockJobRuns.getLatestForResume).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/v1/regenerate-images/cancel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("flips cancelRequested on the running row's checkpoint", async () => {
    mockJobRuns.getRunning.mockResolvedValue({ id: RUN_X, lastSeenAt: new Date() });
    mockJobRuns.getResult.mockResolvedValue({
      snapshot: [],
      totalFiles: 5,
      lastProcessedIndex: 1,
      processed: 2,
      regenerated: 2,
      failed: 0,
      errors: [],
      resumedFromRunId: null,
      cancelRequested: false,
      skipExisting: false,
    });

    const res = await app.request("/api/admin/v1/regenerate-images/cancel", { method: "POST" });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ runId: RUN_X, cancelRequested: true });
    expect(mockJobRuns.requestCancel).toHaveBeenCalledWith(RUN_X);
    expect(mockJobRuns.updateResult).not.toHaveBeenCalled();
  });

  it("404s when no regenerate job is running", async () => {
    mockJobRuns.getRunning.mockResolvedValue(null);
    const res = await app.request("/api/admin/v1/regenerate-images/cancel", { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/v1/refetch-images", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const validUuid1 = "a0000000-0001-4000-a000-000000000001";
  const validUuid2 = "a0000000-0001-4000-a000-000000000002";

  it("returns 200 with the re-fetch result for valid ids", async () => {
    const result = { total: 2, refetched: 2, failed: 0, errors: [] };
    mockRefetchImages.mockResolvedValue(result);

    const res = await app.request("/api/admin/v1/refetch-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: [validUuid1, validUuid2] }),
    });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual(result);
    expect(mockRefetchImages).toHaveBeenCalledWith(mockIo, mockPrintingImages, [
      validUuid1,
      validUuid2,
    ]);
  });

  it("rejects an empty imageIds array", async () => {
    const res = await app.request("/api/admin/v1/refetch-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: [] }),
    });
    expect(res.status).toBe(400);
    expect(mockRefetchImages).not.toHaveBeenCalled();
  });

  it("rejects non-uuid ids", async () => {
    const res = await app.request("/api/admin/v1/refetch-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: ["not-a-uuid"] }),
    });
    expect(res.status).toBe(400);
    expect(mockRefetchImages).not.toHaveBeenCalled();
  });
});
