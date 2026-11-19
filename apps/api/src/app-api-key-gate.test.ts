import { createLogger } from "@openrift/shared/logger";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";

const authHandler = vi.fn(() => new Response("ok"));

const app = createApp({
  db: {} as never,
  auth: {
    handler: authHandler,
    api: { getSession: vi.fn(() => null) },
    $Infer: { Session: { user: null, session: null } },
  } as never,
  config: {
    port: 3000,
    databaseUrl: "postgres://mock",
    isDev: false,
    corsOrigin: undefined,
    auth: { secret: "test-secret", google: undefined, discord: undefined },
    smtp: { configured: false },
    authRateLimitDisabled: true,
  } as never,
  log: createLogger("test", "silent"),
});

function post(path: string, headers: Record<string, string> = {}): Promise<Response> {
  return Promise.resolve(
    app.fetch(
      new Request(`http://localhost${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: "{}",
      }),
    ),
  );
}

describe("API keys in front of better-auth", () => {
  it("refuses a key on better-auth endpoints before the auth handler runs", async () => {
    authHandler.mockClear();
    const res = await post("/api/auth/delete-user", { "x-api-key": "orift_test" });
    expect(res.status).toBe(403);
    expect(authHandler).not.toHaveBeenCalled();
  });

  it("still serves other better-auth endpoints without a key", async () => {
    authHandler.mockClear();
    const res = await post("/api/auth/sign-out");
    expect(res.status).toBe(200);
    expect(authHandler).toHaveBeenCalledTimes(1);
  });
});
