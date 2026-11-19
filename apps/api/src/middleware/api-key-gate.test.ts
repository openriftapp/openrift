import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../errors.js";
import { createApiRouteResolver } from "../orpc/router.js";
import type { Variables } from "../types.js";
import { apiKeyGate } from "./api-key-gate.js";

const resolveApiRoute = createApiRouteResolver();

const getSession = vi.fn();
const permissionsById = vi.fn<(id: string) => Promise<string | null>>();
const isAdmin = vi.fn<(userId: string) => Promise<boolean>>();

let userCounter = 0;
let userId = "";

function buildApp() {
  const app = new Hono<{ Variables: Variables }>();
  app.onError((error, c) => {
    if (error instanceof AppError) {
      return c.json({ code: error.code }, error.status as 403);
    }
    throw error;
  });
  app.use("/api/*", async (c, next) => {
    c.set("auth", { api: { getSession } } as never);
    c.set("repos", {
      apiKeys: { permissionsById },
      admins: { isAdmin },
      adminGrants: { sectionsForUser: () => Promise.resolve([]) },
    } as never);
    await next();
  });
  app.use("/api/*", apiKeyGate(resolveApiRoute));
  app.all("/api/*", (c) =>
    c.json({ user: c.get("user")?.id ?? null, limited: c.get("apiKeyLimited") ?? false }),
  );
  return app;
}

function request(
  path: string,
  init: { method?: string; body?: unknown; key?: string | null } = {},
): Promise<Response> {
  const headers = new Headers();
  if (init.key !== null) {
    headers.set("x-api-key", init.key ?? "orift_test");
  }
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  return Promise.resolve(
    buildApp().request(path, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
  );
}

function grant(permissions: Record<string, string[]>) {
  permissionsById.mockResolvedValue(JSON.stringify(permissions));
}

describe("apiKeyGate", () => {
  beforeEach(() => {
    // getAdminAccess caches per user id, so each test gets a fresh one.
    userCounter += 1;
    userId = `key-user-${userCounter}`;
    getSession.mockReset();
    getSession.mockResolvedValue({ user: { id: userId }, session: { id: "key-1" } });
    permissionsById.mockReset();
    isAdmin.mockReset();
    isAdmin.mockResolvedValue(false);
  });

  it("passes requests without a key untouched", async () => {
    const res = await request("/api/v1/me/api-keys", { key: null });
    expect(res.status).toBe(200);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("refuses every better-auth endpoint", async () => {
    grant({ collection: ["read", "write"], admin: ["access"] });
    isAdmin.mockResolvedValue(true);
    const res = await request("/api/auth/delete-user", { method: "POST", body: {} });
    expect(res.status).toBe(403);
  });

  it("allows a scoped procedure the key holds", async () => {
    grant({ decks: ["read"] });
    const res = await request("/api/v1/decks");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: userId, limited: true });
    expect(permissionsById).toHaveBeenCalledWith("key-1");
  });

  it("refuses write when the key only reads", async () => {
    grant({ decks: ["read"] });
    const res = await request("/api/v1/decks", {
      method: "POST",
      body: { name: "Summoner Skirmish" },
    });
    expect(res.status).toBe(403);
  });

  it("refuses a scope from another area in the oRPC error shape", async () => {
    grant({ decks: ["read", "write"] });
    const res = await request("/api/v1/collections");
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "FORBIDDEN", status: 403, defined: false });
  });

  it("refuses session-gated procedures that carry no scope", async () => {
    grant({ collection: ["read", "write"], lists: ["read", "write"], decks: ["read", "write"] });
    for (const path of ["/api/v1/me/api-keys", "/api/v1/loans", "/api/v1/collections/c-1/share"]) {
      const res = await request(path);
      expect(res.status, path).toBe(403);
    }
  });

  it("refuses a key with no stored permissions", async () => {
    permissionsById.mockResolvedValue(null);
    const res = await request("/api/v1/decks");
    expect(res.status).toBe(403);
  });

  it("marks scoped requests as key-limited", async () => {
    grant({ collection: ["read", "write"] });
    const res = await request("/api/v1/copies/dispose", { method: "POST", body: { copyIds: [] } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: userId, limited: true });
  });

  it("answers public procedures as anonymous without resolving the key", async () => {
    const res = await request("/api/v1/sets");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null, limited: false });
    expect(getSession).not.toHaveBeenCalled();
  });

  it("classifies an encoded path by the procedure oRPC runs", async () => {
    grant({ collection: ["read", "write"], lists: ["read", "write"], decks: ["read", "write"] });
    const res = await request("/api/v1/friend-groups/%70review");
    expect(res.status).toBe(403);
    expect(getSession).toHaveBeenCalled();
  });

  it("answers plain routes as anonymous", async () => {
    const res = await request("/api/v1/decks/d-1/image.png");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null, limited: false });
  });

  it("refuses admin paths without the admin scope", async () => {
    grant({ collection: ["read", "write"] });
    isAdmin.mockResolvedValue(true);
    const res = await request("/api/admin/v1/sets");
    expect(res.status).toBe(403);
  });

  it("lets an admin-scoped key through admin paths", async () => {
    grant({ admin: ["access"] });
    const res = await request("/api/admin/v1/sets");
    expect(res.status).toBe(200);
  });

  it("gives an admin-scoped key full access while its owner is an admin", async () => {
    grant({ admin: ["access"] });
    isAdmin.mockResolvedValue(true);
    const res = await request("/api/v1/loans");
    expect(res.status).toBe(200);
  });

  it("refuses key management to every key, admin-scoped ones included", async () => {
    grant({ collection: ["read", "write"], admin: ["access"] });
    isAdmin.mockResolvedValue(true);
    for (const path of ["/api/v1/me/api-keys", "/api/v1/me/deck-check-keys"]) {
      const res = await request(path, { method: "POST", body: { name: "Summoner Skirmish" } });
      expect(res.status, path).toBe(403);
    }
  });

  it("drops the admin bypass once the owner lost admin access", async () => {
    grant({ admin: ["access"] });
    const res = await request("/api/v1/loans");
    expect(res.status).toBe(403);
  });
});
