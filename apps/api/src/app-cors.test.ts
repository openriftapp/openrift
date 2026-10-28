import { createLogger } from "@openrift/shared/logger";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";

const app = createApp({
  // oxlint-disable-next-line typescript/no-explicit-any -- minimal stubs to boot the app
  db: {} as any,
  // oxlint-disable-next-line typescript/no-explicit-any -- minimal stubs to boot the app
  auth: { handler: () => new Response("ok"), api: { getSession: () => null } } as any,
  config: {
    port: 3000,
    databaseUrl: "postgres://mock",
    corsOrigin: "https://openrift.app",
    auth: { secret: "test-secret", adminEmail: undefined, google: undefined, discord: undefined },
    smtp: { configured: false },
    isDev: false,
    // oxlint-disable-next-line typescript/no-explicit-any -- minimal stubs to boot the app
  } as any,
  log: createLogger("test", "silent"),
});

async function preflight(path: string, origin: string): Promise<Response> {
  return await app.fetch(
    new Request(`http://localhost${path}`, {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "GET" },
    }),
  );
}

describe("CORS", () => {
  it.each([
    "/api/v1/catalog",
    "/api/v1/cards/annie-fiery",
    "/api/v1/prices/links",
    "/api/v1/search",
    "/api/v1/search/named",
    "/api/v1/search/random",
  ])("opens developer endpoint %s to any origin without credentials", async (path) => {
    const res = await preflight(path, "https://deck-tool.example");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect(res.headers.get("Vary") ?? "").not.toContain("Origin");
  });

  it("refuses unlisted origins on other endpoints", async () => {
    const res = await preflight("/api/v1/feature-flags", "https://deck-tool.example");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("echoes allowed origins with credentials on other endpoints", async () => {
    const res = await preflight("/api/v1/feature-flags", "https://openrift.app");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://openrift.app");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(res.headers.get("Vary")).toContain("Origin");
  });
});
