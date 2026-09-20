import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { badgesRouter } from "./authenticated-badges.js";

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const GROUP_ID = "00000000-0000-4000-a000-000000000001";

function makeApp(overrides: {
  byGroup?: {
    groupId: string;
    groupSlug: string;
    count: number;
    respondCount: number;
    settleCount: number;
  }[];
  people?: number;
  loans?: number;
  pendingRequests?: number;
}) {
  const app = new Hono<{ Variables: Variables }>();
  app.use("*", async (c, next) => {
    c.set("user", { id: USER_ID } as never);
    c.set("repos", {
      cardTrades: {
        actionNeededCountsForUser: vi.fn(() => Promise.resolve(overrides.byGroup ?? [])),
        actionNeededPeopleForUser: vi.fn(() => Promise.resolve(overrides.people ?? 0)),
      },
      loans: {
        actionNeededCountForUser: vi.fn(() => Promise.resolve(overrides.loans ?? 0)),
      },
      friendGroups: {
        pendingRequestsCountForUser: vi.fn(() => Promise.resolve(overrides.pendingRequests ?? 0)),
      },
    } as never);
    await next();
  });
  registerRouterForTest(app as never, badgesRouter);
  return app;
}

describe("GET /api/v1/badges", () => {
  it("answers every header badge in one read", async () => {
    const app = makeApp({
      byGroup: [
        { groupId: GROUP_ID, groupSlug: "playgroup", count: 3, respondCount: 1, settleCount: 2 },
      ],
      people: 2,
      loans: 1,
      pendingRequests: 4,
    });

    const res = await app.request("/api/v1/badges");

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({
      trades: {
        total: 3,
        people: 2,
        byGroup: [
          { groupId: GROUP_ID, groupSlug: "playgroup", count: 3, respondCount: 1, settleCount: 2 },
        ],
      },
      loans: { total: 1 },
      groupRequests: { count: 4 },
    });
  });

  it("sums the trade total across groups", async () => {
    const app = makeApp({
      byGroup: [
        { groupId: GROUP_ID, groupSlug: "a", count: 3, respondCount: 3, settleCount: 0 },
        {
          groupId: "00000000-0000-4000-a000-000000000002",
          groupSlug: "b",
          count: 2,
          respondCount: 0,
          settleCount: 2,
        },
      ],
    });

    const res = await app.request("/api/v1/badges");

    const body = await readJson<{ trades: { total: number } }>(res);
    expect(body.trades.total).toBe(5);
  });

  it("returns zeroes when nothing is waiting on the viewer", async () => {
    const res = await makeApp({}).request("/api/v1/badges");

    expect(await readJson(res)).toEqual({
      trades: { total: 0, people: 0, byGroup: [] },
      loans: { total: 0 },
      groupRequests: { count: 0 },
    });
  });
});
