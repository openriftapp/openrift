import { createLogger } from "@openrift/shared/logger";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";

// Plain Hono handlers have no contract output for `public-output-urls.test.ts` to read,
// so each is listed with what it returns and a new one fails until it is reviewed.
const REVIEWED_PLAIN_ROUTES = new Map<string, string>([
  ["GET /metrics", "metrics text"],
  ["GET /api/auth/*", "auth handler"],
  ["POST /api/auth/*", "auth handler"],
  ["GET /api/doc", "OpenAPI document"],
  ["GET /api/developers/doc", "OpenAPI document"],
  ["GET /api/ui", "OpenAPI viewer page"],
  ["GET /api/developers/ui", "OpenAPI viewer page"],
  ["GET /api/swagger-ui-dist/:file", "OpenAPI viewer assets"],
  ["GET /api/health", "status JSON"],
  ["GET /api/v1/cards/:cardSlug/image.png", "rendered PNG"],
  ["GET /api/v1/cards/:cardSlug/:printingSlug/image.png", "rendered PNG"],
  ["GET /api/v1/lists/share/:token/image.png", "rendered PNG"],
  ["GET /api/v1/users/share/:token/image.png", "rendered PNG"],
  ["GET /api/v1/collections/share/:token/image.png", "rendered PNG"],
  ["GET /api/v1/decks/share/:token/image.png", "rendered PNG"],
  ["GET /api/v1/tier-lists/share/:token/image.png", "rendered PNG"],
  ["GET /api/v1/board-states/share/:token/image.png", "rendered PNG"],
  ["GET /api/v1/errata/image.png", "rendered PNG"],
  ["GET /api/v1/developers/image.png", "rendered PNG"],
  ["POST /api/v1/decks/image", "rendered PNG"],
  ["GET /api/v1/lists/:id/image.png", "rendered PNG"],
  ["GET /api/v1/collections/:id/image.png", "rendered PNG"],
  ["GET /api/v1/decks/:id/image.png", "rendered PNG"],
  ["GET /api/v1/tier-lists/:id/image.png", "rendered PNG"],
  ["GET /api/v1/oembed", "oEmbed JSON linking only to this site's share image route"],
  ["GET /api/v1/chat/card", "chat text with links to this site"],
  ["GET /api/v1/calendar-feeds/:file{[A-Za-z0-9_-]+[.]ics}", "iCalendar with links to this site"],
  ["POST /api/v1/sentry-tunnel", "error report relay"],
  ["POST /api/v1/unsubscribe/one-click", "empty response"],
]);

function plainRoutes(): string[] {
  const app = createApp({
    db: {} as never,
    auth: {
      handler: () => new Response("ok"),
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
    } as never,
    log: createLogger("test", "silent"),
  });
  const routes = app.routes
    .filter(({ method, path }) => method !== "ALL" && !path.startsWith("/api/admin/"))
    .map(({ method, path }) => `${method} ${path}`);
  return [...new Set(routes)];
}

describe("plain Hono routes", () => {
  const routes = plainRoutes();

  it("finds the share image routes", () => {
    expect(routes).toContain("GET /api/v1/decks/share/:token/image.png");
  });

  it("serves only reviewed plain routes outside the admin prefix", () => {
    expect(routes.filter((route) => !REVIEWED_PLAIN_ROUTES.has(route))).toEqual([]);
  });

  it("keeps no reviewed entry that no route still serves", () => {
    const served = new Set(routes);
    expect([...REVIEWED_PLAIN_ROUTES.keys()].filter((route) => !served.has(route))).toEqual([]);
  });
});
