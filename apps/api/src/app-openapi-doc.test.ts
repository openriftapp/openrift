import { createLogger } from "@openrift/shared/logger";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import { developerOperations } from "./openapi-doc.js";

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
  components?: { securitySchemes?: Record<string, unknown>; schemas?: Record<string, unknown> };
}

interface DeveloperOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  responses?: Record<string, { content?: Record<string, { schema?: unknown }> } | undefined>;
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

  it("developer /api/developers/doc contains exactly the contracts flagged developerApi", async () => {
    const doc = await fetchDoc("/api/developers/doc");
    expect(doc.info.title).toBe("OpenRift Developer API");
    const operations = Object.entries(doc.paths).flatMap(([path, item]) =>
      Object.keys(item).map((method) => `${method.toUpperCase()} ${path}`),
    );
    expect(operations.toSorted()).toEqual(developerOperations().toSorted());
    expect(operations).toContain("GET /api/v1/cards/{cardSlug}");
    expect(operations).not.toContain("GET /api/v1/cards/{cardSlug}/related");
    expect(doc.security).toEqual([]);
    for (const item of Object.values(doc.paths)) {
      expect(Object.keys(item)).toEqual(["get"]);
      expect(item.get?.security).toEqual([]);
    }
  });

  it("developer operations carry an operationId, a summary and a description", async () => {
    const doc = await fetchDoc("/api/developers/doc");
    for (const [path, item] of Object.entries(doc.paths)) {
      const operation = item.get as DeveloperOperation;
      expect(operation.operationId, path).toMatch(/^[a-z][A-Za-z]+$/u);
      expect(operation.summary, path).toBeTruthy();
      expect(operation.description, path).toBeTruthy();
    }
  });

  it("developer operations with parameters declare a 400 against the shared Error schema", async () => {
    const doc = await fetchDoc("/api/developers/doc");
    const card = doc.paths["/api/v1/cards/{cardSlug}"]?.get as DeveloperOperation;
    expect(card.responses?.["400"]).toEqual({
      description: expect.stringContaining("data.issues"),
      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
    });
    const prices = doc.paths["/api/v1/prices"]?.get as DeveloperOperation;
    expect(prices.responses?.["400"]).toBeUndefined();
  });

  it("names the shared shapes as components and refs them from responses", async () => {
    const doc = await fetchDoc("/api/developers/doc");
    const schemas = doc.components?.schemas ?? {};
    for (const name of ["Card", "CatalogCard", "Printing", "Set", "Rule", "RuleVersion", "Error"]) {
      expect(schemas, name).toHaveProperty(name);
    }
    const catalog = doc.paths["/api/v1/catalog"]?.get as DeveloperOperation;
    const body = catalog.responses?.["200"]?.content?.["application/json"]?.schema;
    expect(JSON.stringify(body)).toContain('"$ref":"#/components/schemas/Printing"');
    expect(JSON.stringify(body)).toContain('"$ref":"#/components/schemas/CatalogCard"');
  });

  it("describes card types only as the ordered types list", async () => {
    const doc = await fetchDoc("/api/developers/doc");
    for (const name of ["Card", "CatalogCard"]) {
      const card = doc.components?.schemas?.[name] as { properties: Record<string, unknown> };
      expect(card.properties, name).not.toHaveProperty("type");
      expect(card.properties, name).toHaveProperty("types");
    }
  });

  it("sets servers from the forwarded origin and omits it otherwise", async () => {
    const forwarded = await app.fetch(
      new Request("http://localhost/api/developers/doc", {
        headers: { host: "openrift.example", "x-forwarded-proto": "https" },
      }),
    );
    expect(((await forwarded.json()) as { servers?: unknown }).servers).toEqual([
      { url: "https://openrift.example" },
    ]);
    const direct = await fetchDoc("/api/developers/doc");
    expect((direct as { servers?: unknown }).servers).toBeUndefined();
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
