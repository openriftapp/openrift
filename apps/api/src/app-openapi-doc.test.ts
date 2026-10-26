import { createLogger } from "@openrift/shared/logger";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";

const mockAuth = {
  handler: () => new Response("ok"),
  api: { getSession: () => null },
  $Infer: { Session: { user: null, session: null } },
};

const app = createApp({
  // oxlint-disable-next-line typescript/no-explicit-any -- minimal stubs to boot the app
  db: {} as any,
  // oxlint-disable-next-line typescript/no-explicit-any -- minimal stubs to boot the app
  auth: mockAuth as any,
  config: {
    port: 3000,
    databaseUrl: "postgres://mock",
    corsOrigin: undefined,
    auth: { secret: "test-secret", adminEmail: undefined, google: undefined, discord: undefined },
    smtp: { configured: false },
    isDev: false,
    // oxlint-disable-next-line typescript/no-explicit-any -- minimal stubs to boot the app
  } as any,
  log: createLogger("test", "silent"),
});

interface DocShape {
  paths: Record<string, Record<string, { security?: unknown } | undefined>>;
  info: { title: string };
  security?: unknown;
  components?: { securitySchemes?: Record<string, unknown> };
}

async function fetchDoc(path: string): Promise<DocShape> {
  const res = await app.fetch(new Request(`http://localhost${path}`));
  expect(res.status).toBe(200);
  return res.json() as Promise<DocShape>;
}

describe("OpenAPI doc split", () => {
  it("public /api/doc excludes the admin surface", async () => {
    const doc = await fetchDoc("/api/doc");
    const paths = Object.keys(doc.paths);
    expect(doc.info.title).toBe("OpenRift API");
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.some((p) => p.startsWith("/api/admin/"))).toBe(false);
    expect(paths).toContain("/api/v1/catalog");
    expect(paths).toContain("/api/v1/ingest/deck-check");

    expect(doc.security).toEqual([{ cookieAuth: [] }]);
    expect(doc.components?.securitySchemes).toHaveProperty("cookieAuth");
    expect(doc.components?.securitySchemes).toHaveProperty("bearerAuth");
    expect(doc.paths["/api/v1/catalog"]?.get?.security).toEqual([]);
    expect(doc.paths["/api/v1/ingest/deck-check"]?.post?.security).toEqual([{ bearerAuth: [] }]);
  });

  it("developer /api/developers/doc contains only the curated public operations", async () => {
    const doc = await fetchDoc("/api/developers/doc");
    expect(doc.info.title).toBe("OpenRift Developer API");
    expect(Object.keys(doc.paths).toSorted()).toEqual([
      "/api/v1/cards/{cardSlug}",
      "/api/v1/catalog",
      "/api/v1/prices",
      "/api/v1/prices/marketplace-info",
      "/api/v1/prices/{printingId}/history",
      "/api/v1/rules",
      "/api/v1/rules/versions",
      "/api/v1/sets",
    ]);
    expect(doc.security).toEqual([]);
    for (const item of Object.values(doc.paths)) {
      expect(Object.keys(item)).toEqual(["get"]);
      expect(item.get?.security).toEqual([]);
    }
  });

  it("admin /api/admin/doc contains only the admin surface", async () => {
    const doc = await fetchDoc("/api/admin/doc");
    const paths = Object.keys(doc.paths);
    expect(doc.info.title).toBe("OpenRift Admin API");
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((p) => p.startsWith("/api/admin/"))).toBe(true);
    expect(paths).toContain("/api/admin/v1/users");

    expect(doc.security).toEqual([{ cookieAuth: [] }]);
    expect(doc.components?.securitySchemes).toHaveProperty("adminAuth");
    expect(doc.paths["/api/admin/v1/users"]?.get?.security).toEqual([{ adminAuth: [] }]);
  });
});
