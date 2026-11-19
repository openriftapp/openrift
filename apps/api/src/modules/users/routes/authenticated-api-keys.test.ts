import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import type { ApiKeyRow } from "../repositories/api-keys.js";
import { apiKeysRouter } from "./authenticated-api-keys.js";

const mockApiKeysRepo = {
  listActiveForUser: vi.fn((_userId: string, _now: Date) => Promise.resolve([] as ApiKeyRow[])),
  deleteForUser: vi.fn((_id: string, _userId: string) => Promise.resolve(true)),
};
const isAdmin = vi.fn((_userId: string) => Promise.resolve(false));
const createApiKey = vi.fn();

let userCounter = 0;
let userId = "";

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: userId } as never);
  c.set("auth", { api: { createApiKey } } as never);
  c.set("repos", {
    apiKeys: mockApiKeysRepo,
    admins: { isAdmin },
    adminGrants: { sectionsForUser: () => Promise.resolve([]) },
  } as never);
  await next();
});
registerRouterForTest(app, apiKeysRouter);
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.message, code: err.code }, err.status as 400);
  }
  throw err;
});

function row(overrides: Partial<ApiKeyRow> = {}): ApiKeyRow {
  return {
    id: "key-1",
    name: "Deck bot",
    start: "orift_",
    permissions: JSON.stringify({ decks: ["read", "write"] }),
    createdAt: new Date("2026-11-01T10:00:00Z"),
    expiresAt: null,
    lastRequest: null,
    ...overrides,
  };
}

function post(body: unknown): Promise<Response> {
  return Promise.resolve(
    app.request("/api/v1/me/api-keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const VALID = {
  name: "Deck bot",
  grants: { collection: "none", lists: "read", decks: "write" },
  admin: false,
  expiresInDays: 90,
};

beforeEach(() => {
  vi.resetAllMocks();
  // getAdminAccess caches per user id, so each test gets a fresh one.
  userCounter += 1;
  userId = `api-key-owner-${userCounter}`;
  mockApiKeysRepo.listActiveForUser.mockResolvedValue([]);
  mockApiKeysRepo.deleteForUser.mockResolvedValue(true);
  isAdmin.mockResolvedValue(false);
  createApiKey.mockImplementation(({ body }) =>
    Promise.resolve({
      id: "key-new",
      key: "orift_plaintext",
      name: body.name,
      start: "orift_",
      permissions: body.permissions,
      createdAt: new Date("2026-11-19T10:00:00Z"),
      expiresAt: body.expiresIn ? new Date("2027-02-17T10:00:00Z") : null,
    }),
  );
});

describe("GET /api/v1/me/api-keys", () => {
  it("lists the caller's keys with their grants", async () => {
    mockApiKeysRepo.listActiveForUser.mockResolvedValue([row()]);
    const res = await app.request("/api/v1/me/api-keys");
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({
      items: [
        {
          id: "key-1",
          name: "Deck bot",
          start: "orift_",
          grants: { collection: "none", lists: "none", decks: "write" },
          admin: false,
          createdAt: "2026-11-01T10:00:00.000Z",
          expiresAt: null,
          lastUsedAt: null,
        },
      ],
    });
    expect(mockApiKeysRepo.listActiveForUser).toHaveBeenCalledWith(userId, expect.any(Date));
  });
});

describe("POST /api/v1/me/api-keys", () => {
  it("creates a scoped key server-side and returns the token once", async () => {
    const res = await post(VALID);
    expect(res.status).toBe(201);
    const json = await readJson(res);
    expect(json.token).toBe("orift_plaintext");
    expect(json.key.grants).toEqual({ collection: "none", lists: "read", decks: "write" });
    expect(createApiKey).toHaveBeenCalledWith({
      body: {
        userId,
        name: "Deck bot",
        permissions: { lists: ["read"], decks: ["read", "write"] },
        expiresIn: 90 * 24 * 60 * 60,
      },
    });
  });

  it("omits the expiry for a key that never expires", async () => {
    await post({ ...VALID, expiresInDays: null });
    expect(createApiKey.mock.calls[0]?.[0].body).not.toHaveProperty("expiresIn");
  });

  it("refuses a key without any scope", async () => {
    const res = await post({
      ...VALID,
      grants: { collection: "none", lists: "none", decks: "none" },
    });
    expect(res.status).toBe(400);
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it("refuses expiry values outside the offered choices", async () => {
    const res = await post({ ...VALID, expiresInDays: 7 });
    expect(res.status).toBe(400);
  });

  it("refuses the admin scope for users without admin access", async () => {
    const res = await post({ ...VALID, admin: true });
    expect(res.status).toBe(403);
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it("grants the admin scope to admins", async () => {
    isAdmin.mockResolvedValue(true);
    const res = await post({ ...VALID, admin: true });
    expect(res.status).toBe(201);
    expect(createApiKey.mock.calls[0]?.[0].body.permissions).toEqual({
      lists: ["read"],
      decks: ["read", "write"],
      admin: ["access"],
    });
  });

  it("refuses an 11th key", async () => {
    mockApiKeysRepo.listActiveForUser.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => row({ id: `key-${index}` })),
    );
    const res = await post(VALID);
    expect(res.status).toBe(409);
    expect(createApiKey).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/v1/me/api-keys/:keyId", () => {
  it("deletes the caller's key", async () => {
    const res = await app.request("/api/v1/me/api-keys/key-1", { method: "DELETE" });
    expect(res.status).toBe(204);
    expect(mockApiKeysRepo.deleteForUser).toHaveBeenCalledWith("key-1", userId);
  });

  it("404s a key the caller does not own", async () => {
    mockApiKeysRepo.deleteForUser.mockResolvedValue(false);
    const res = await app.request("/api/v1/me/api-keys/key-9", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
