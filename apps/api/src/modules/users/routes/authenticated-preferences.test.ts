import { PREFERENCE_DEFAULTS } from "@openrift/shared/types/api/preferences";
import { Hono } from "hono";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { preferencesRouter } from "./authenticated-preferences";

const mockRepo = {
  getByUserId: vi.fn(() => Promise.resolve(undefined as object | undefined)),
  upsert: vi.fn(() => Promise.resolve({})),
};

const USER_ID = "a0000000-0001-4000-a000-000000000001";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as any);
  c.set("repos", { userPreferences: mockRepo } as any);
  await next();
});
registerRouterForTest(app, preferencesRouter);
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code }, err.status as 400);
  }
  throw err;
});

describe("GET /api/v1/preferences", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns stored preferences when they exist", async () => {
    const storedPrefs = {
      ...PREFERENCE_DEFAULTS,
      showImages: false,
      theme: "dark",
    };
    mockRepo.getByUserId.mockResolvedValue({ userId: USER_ID, data: storedPrefs });
    const res = await app.request("/api/v1/preferences");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.showImages).toBe(false);
    expect(json.theme).toBe("dark");
    expect(mockRepo.getByUserId).toHaveBeenCalledWith(USER_ID);
  });

  it("returns empty object when row exists but data is null", async () => {
    mockRepo.getByUserId.mockResolvedValue({ userId: USER_ID, data: null });
    const res = await app.request("/api/v1/preferences");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({});
  });

  it.each([
    {
      name: "returns stored languages and leaves out a stored completionScope",
      data: {
        languages: ["en", "de"],
        completionScope: { sets: ["set-a"], promos: "exclude", signed: true },
      },
      expected: { languages: ["en", "de"] },
    },
    {
      name: "does not leak undocumented stored keys",
      data: { showImages: true, hiddenFilterSections: ["sets"] },
      expected: { showImages: true },
    },
  ])("$name", async ({ data, expected }) => {
    mockRepo.getByUserId.mockResolvedValue({ userId: USER_ID, data });
    const res = await app.request("/api/v1/preferences");
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual(expected);
  });

  it.each([
    {
      name: "drops a stored value the response schema rejects and keeps the rest",
      data: { theme: "solarized", showImages: false, defaultCurrency: "GBP" },
      expected: { showImages: false },
    },
    {
      name: "drops a nested value the response schema rejects",
      data: { emailNotifications: { tradeMatches: "yes" }, languages: ["en"] },
      expected: { languages: ["en"] },
    },
  ])("$name", async ({ data, expected }) => {
    mockRepo.getByUserId.mockResolvedValue({ userId: USER_ID, data });
    const res = await app.request("/api/v1/preferences");
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual(expected);
  });
});

describe("PATCH /api/v1/preferences", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    { name: "showImages", body: { showImages: false } },
    { name: "theme", body: { theme: "dark" } },
    { name: "fancyFan", body: { fancyFan: false } },
    { name: "marketplaceOrder", body: { marketplaceOrder: ["cardmarket", "tcgplayer"] } },
    { name: "defaultCardView", body: { defaultCardView: "cards" } },
  ])("updates the $name preference", async ({ body }) => {
    mockRepo.upsert.mockResolvedValue(body);
    const res = await app.request("/api/v1/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual(body);
    expect(mockRepo.upsert).toHaveBeenCalledWith(USER_ID, body);
  });

  it("rejects invalid defaultCardView value", async () => {
    const res = await app.request("/api/v1/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultCardView: "copies" }),
    });
    expect(res.status).toBe(400);
  });

  it("accepts an older client's retired filter keys and stores nothing for them", async () => {
    mockRepo.upsert.mockResolvedValue({ languages: ["en"] });
    const res = await app.request("/api/v1/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        languages: ["en"],
        hiddenFilterSections: null,
        compactFilterView: null,
      }),
    });
    expect(res.status).toBe(200);
    expect(mockRepo.upsert).toHaveBeenCalledWith(USER_ID, { languages: ["en"] });
  });

  it("accepts an older client's completionScope and stores nothing for it", async () => {
    mockRepo.upsert.mockResolvedValue({ languages: ["en"] });
    const res = await app.request("/api/v1/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        languages: ["en"],
        completionScope: { sets: ["set-a"], promos: "sometimes" },
      }),
    });
    expect(res.status).toBe(200);
    expect(mockRepo.upsert).toHaveBeenCalledWith(USER_ID, { languages: ["en"] });
    expect(await readJson(res)).toEqual({ languages: ["en"] });
  });
});

describe("preferences read/write schema parity", () => {
  it("declares every PATCH (write) field in the GET response (read) schema", async () => {
    // Dynamic import: the contract's .openapi() call needs @hono/zod-openapi's Zod
    // extension, which only runs after the statically imported route above loads it.
    const { updatePreferencesSchema, userPreferencesResponseSchema } =
      await import("@openrift/shared/contracts/preferences");

    const writeKeys = Object.keys(updatePreferencesSchema.shape);
    const readKeys = new Set(Object.keys(userPreferencesResponseSchema.shape));

    const missingFromRead = writeKeys.filter((key) => !readKeys.has(key));

    expect(missingFromRead).toEqual([]);
  });
});
