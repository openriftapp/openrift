import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { AppError } from "../../../errors.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { friendGroupsCalendarFeedsRouter } from "./authenticated-friend-groups-calendar-feeds.js";

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const GROUP_ID = "00000000-0000-4000-a000-000000000001";

const now = new Date("2026-09-15T00:00:00Z");

const group = {
  id: GROUP_ID,
  slug: "playgroup",
  name: "Hexgate Playgroup",
  description: null,
  code: null,
  codeRotatedAt: now,
  createdAt: now,
  updatedAt: now,
};

function makeApp(overrides: { calendarFeeds?: Record<string, unknown>; isMember?: boolean }) {
  const friendGroups = {
    getBySlugOrPrevious: vi.fn(() => Promise.resolve(group)),
    getMembership: vi.fn(() =>
      Promise.resolve(
        overrides.isMember === false
          ? undefined
          : { groupId: GROUP_ID, userId: USER_ID, role: "member" as const, joinedAt: now },
      ),
    ),
  };
  const friendGroupCalendarFeeds = {
    listForMember: vi.fn(() => Promise.resolve([])),
    enable: vi.fn((values: { kind: string; token: string }) =>
      Promise.resolve({ kind: values.kind, token: values.token }),
    ),
    disable: vi.fn(() => Promise.resolve()),
    ...overrides.calendarFeeds,
  };

  const app = new Hono<{ Variables: Variables }>();
  app.use("*", async (c, next) => {
    c.set("user", { id: USER_ID } as never);
    c.set("repos", { friendGroups, friendGroupCalendarFeeds } as never);
    await next();
  });
  registerRouterForTest(app as never, friendGroupsCalendarFeedsRouter);
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.status as 400);
    }
    throw err;
  });

  return { app, friendGroupCalendarFeeds };
}

describe("friend-group calendar feeds route", () => {
  it("GET /calendar-feeds lists the viewer's own feeds for the group", async () => {
    const { app, friendGroupCalendarFeeds } = makeApp({
      calendarFeeds: {
        listForMember: vi.fn(() => Promise.resolve([{ kind: "tournaments", token: "tok-1" }])),
      },
    });

    const res = await app.request("/api/v1/friend-groups/playgroup/calendar-feeds");

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ items: [{ kind: "tournaments", token: "tok-1" }] });
    expect(friendGroupCalendarFeeds.listForMember).toHaveBeenCalledWith(GROUP_ID, USER_ID);
  });

  it("PUT /calendar-feeds/:kind creates the feed with a 32-character url-safe token", async () => {
    const { app, friendGroupCalendarFeeds } = makeApp({});

    const res = await app.request("/api/v1/friend-groups/playgroup/calendar-feeds/shop_events", {
      method: "PUT",
    });

    expect(res.status).toBe(200);
    const body = (await readJson(res)) as { kind: string; token: string };
    expect(body.kind).toBe("shop_events");
    expect(body.token).toMatch(/^[\w-]{32}$/u);
    expect(friendGroupCalendarFeeds.enable).toHaveBeenCalledWith({
      groupId: GROUP_ID,
      userId: USER_ID,
      kind: "shop_events",
      token: body.token,
    });
  });

  it("PUT /calendar-feeds/:kind draws a fresh token on every call", async () => {
    const { app, friendGroupCalendarFeeds } = makeApp({});

    for (let i = 0; i < 2; i++) {
      await app.request("/api/v1/friend-groups/playgroup/calendar-feeds/tournaments", {
        method: "PUT",
      });
    }

    const tokens = friendGroupCalendarFeeds.enable.mock.calls.map(([values]) => values.token);
    expect(new Set(tokens).size).toBe(2);
  });

  it("PUT /calendar-feeds/:kind rejects an unknown feed kind", async () => {
    const { app, friendGroupCalendarFeeds } = makeApp({});

    const res = await app.request("/api/v1/friend-groups/playgroup/calendar-feeds/decks", {
      method: "PUT",
    });

    expect(res.status).toBe(400);
    expect(friendGroupCalendarFeeds.enable).not.toHaveBeenCalled();
  });

  it("DELETE /calendar-feeds/:kind turns the viewer's feed off", async () => {
    const { app, friendGroupCalendarFeeds } = makeApp({});

    const res = await app.request("/api/v1/friend-groups/playgroup/calendar-feeds/tournaments", {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
    expect(friendGroupCalendarFeeds.disable).toHaveBeenCalledWith(GROUP_ID, USER_ID, "tournaments");
  });

  it("answers 404 to a viewer who is not a member", async () => {
    const { app, friendGroupCalendarFeeds } = makeApp({ isMember: false });

    const res = await app.request("/api/v1/friend-groups/playgroup/calendar-feeds/tournaments", {
      method: "PUT",
    });

    expect(res.status).toBe(404);
    expect(friendGroupCalendarFeeds.enable).not.toHaveBeenCalled();
  });
});
