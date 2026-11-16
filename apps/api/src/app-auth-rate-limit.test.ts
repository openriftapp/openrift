import { createLogger } from "@openrift/shared/logger";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";

function buildApp(authRateLimitDisabled: boolean) {
  return createApp({
    db: {} as any,
    auth: { handler: () => new Response("ok"), api: { getSession: () => null } } as any,
    config: {
      port: 3000,
      databaseUrl: "postgres://mock",
      corsOrigin: undefined,
      authRateLimitDisabled,
      auth: { secret: "test-secret", google: undefined, discord: undefined },
      smtp: { configured: false },
      isDev: false,
    } as any,
    log: createLogger("test", "silent"),
  });
}

let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `192.0.2.${ipCounter}`;
}

async function statusesOfElevenPosts(app: ReturnType<typeof buildApp>, path: string) {
  const ip = nextIp();
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 11; attempt++) {
    const res = await app.fetch(
      new Request(`http://localhost${path}`, { method: "POST", headers: { "x-real-ip": ip } }),
    );
    statuses.push(res.status);
  }
  return statuses;
}

describe("auth rate limiter", () => {
  const app = buildApp(false);

  it.each([
    "/api/auth/sign-in/email",
    "/api/auth/sign-in/email-otp",
    "/api/auth/sign-up/email",
    "/api/auth/email-otp/send-verification-otp",
    "/api/auth/email-otp/request-password-reset",
    "/api/auth/forget-password/email-otp",
    "/api/auth/request-password-reset",
    "/api/auth/reset-password",
    "/api/auth/send-verification-email",
    "/api/auth/change-email",
    "/api/auth/change-password",
    "/api/auth/delete-user",
    "/api/auth/verify-password",
  ])("limits %s to 10 requests per window", async (path) => {
    const statuses = await statusesOfElevenPosts(app, path);
    expect(statuses.slice(0, 10)).not.toContain(429);
    expect(statuses.at(-1)).toBe(429);
  });

  it.each(["/api/auth/get-session", "/api/auth/update-user", "/api/auth/sign-out"])(
    "leaves %s unlimited",
    async (path) => {
      expect(await statusesOfElevenPosts(app, path)).not.toContain(429);
    },
  );

  it("is off when the config disables it", async () => {
    const statuses = await statusesOfElevenPosts(buildApp(true), "/api/auth/sign-in/email");
    expect(statuses).not.toContain(429);
  });
});
