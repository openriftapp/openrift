import { createLogger } from "@openrift/shared/logger";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";
import { collectContractRoutes } from "./lib/contract-routes.js";

const getSession = vi.fn(() => null);

function buildApp() {
  return createApp({
    db: {} as any,
    auth: {
      handler: () => new Response("ok"),
      api: { getSession },
      $Infer: { Session: { user: null, session: null } },
    } as any,
    config: {
      port: 3000,
      databaseUrl: "postgres://mock",
      isDev: false,
      corsOrigin: undefined,
      auth: { secret: "test-secret", adminEmail: undefined, google: undefined, discord: undefined },
      smtp: { configured: false },
    } as any,
    log: createLogger("test", "silent"),
  });
}

const viewerVaryingPaths = collectContractRoutes()
  .filter(({ method, meta }) => method === "GET" && meta.cacheVary === "viewer")
  .map(({ path }) => path.replaceAll(/\{[^}]+\}/gu, "x"));

describe("viewer-varying reads", () => {
  it("includes the meta pending-submissions read", () => {
    expect(viewerVaryingPaths).toContain("/api/v1/meta/events/x/pending-submissions");
  });

  it.each(viewerVaryingPaths)("loads the session and sets Vary: Cookie on %s", async (path) => {
    getSession.mockClear();
    const res = await buildApp().fetch(new Request(`http://localhost${path}`));

    expect(getSession).toHaveBeenCalled();
    expect(res.headers.get("Vary")).toContain("Cookie");
  });
});
