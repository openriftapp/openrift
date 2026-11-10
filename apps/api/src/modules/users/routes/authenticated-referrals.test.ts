import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { referralsRouter } from "./authenticated-referrals";

const mockReferralsRepo = {
  getCode: vi.fn(() => Promise.resolve(null as string | null)),
  setCodeIfMissing: vi.fn((_userId: string, code: string) =>
    Promise.resolve(code as string | null),
  ),
  claim: vi.fn(() => Promise.resolve(false)),
  counts: vi.fn(() => Promise.resolve({ signedUp: 0, counted: 0 })),
};

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const CODE = "AbC123xyz789";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("repos", { referrals: mockReferralsRepo } as never);
  await next();
});
registerRouterForTest(app, referralsRouter);
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code }, err.status as 400);
  }
  throw err;
});

beforeEach(() => {
  vi.resetAllMocks();
  mockReferralsRepo.counts.mockResolvedValue({ signedUp: 0, counted: 0 });
});

describe("GET /api/v1/referral", () => {
  it("returns the existing code with counts", async () => {
    mockReferralsRepo.getCode.mockResolvedValue(CODE);
    mockReferralsRepo.counts.mockResolvedValue({ signedUp: 3, counted: 2 });
    const res = await app.request("/api/v1/referral");
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ code: CODE, signedUp: 3, counted: 2 });
    expect(mockReferralsRepo.setCodeIfMissing).not.toHaveBeenCalled();
  });

  it("creates a code on first request", async () => {
    mockReferralsRepo.getCode.mockResolvedValue(null);
    mockReferralsRepo.setCodeIfMissing.mockImplementation((_userId, code) => Promise.resolve(code));
    const res = await app.request("/api/v1/referral");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.code).toMatch(/^[A-Za-z0-9]{12}$/u);
    expect(mockReferralsRepo.setCodeIfMissing).toHaveBeenCalledWith(USER_ID, json.code);
  });

  it("returns 404 when the user row is gone", async () => {
    mockReferralsRepo.getCode.mockResolvedValue(null);
    mockReferralsRepo.setCodeIfMissing.mockResolvedValue(null);
    const res = await app.request("/api/v1/referral");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/referral/claim", () => {
  it("reports a recorded referral", async () => {
    mockReferralsRepo.claim.mockResolvedValue(true);
    const res = await app.request("/api/v1/referral/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: CODE }),
    });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ claimed: true });
    expect(mockReferralsRepo.claim).toHaveBeenCalledWith(USER_ID, CODE);
  });

  it("reports a refused claim without erroring", async () => {
    mockReferralsRepo.claim.mockResolvedValue(false);
    const res = await app.request("/api/v1/referral/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: CODE }),
    });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ claimed: false });
  });

  it("rejects a malformed code", async () => {
    const res = await app.request("/api/v1/referral/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "nope" }),
    });
    expect(res.status).toBe(400);
    expect(mockReferralsRepo.claim).not.toHaveBeenCalled();
  });
});
