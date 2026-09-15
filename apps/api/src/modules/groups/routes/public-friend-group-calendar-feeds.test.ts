import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Variables } from "../../../types.js";
import { publicFriendGroupCalendarFeedsRoute } from "./public-friend-group-calendar-feeds.js";

const GROUP_ID = "00000000-0000-4000-a000-000000000001";

const mockCalendarFeedsRepo = { findByToken: vi.fn() };
const mockTournamentsRepo = { listForGroup: vi.fn() };
const mockShopsRepo = { listFeedEvents: vi.fn() };

const app = new Hono<{ Variables: Variables }>()
  .use("*", async (c, next) => {
    c.set("repos", {
      friendGroupCalendarFeeds: mockCalendarFeedsRepo,
      tournaments: mockTournamentsRepo,
      friendGroupShops: mockShopsRepo,
    } as never);
    c.set("config", { appBaseUrl: "https://example.test" } as never);
    await next();
  })
  .route("/api/v1", publicFriendGroupCalendarFeedsRoute);

beforeEach(() => {
  mockCalendarFeedsRepo.findByToken.mockReset();
  mockTournamentsRepo.listForGroup.mockReset();
  mockShopsRepo.listFeedEvents.mockReset();
});

describe("GET /api/v1/calendar-feeds/:token.ics", () => {
  it("serves the group's tournaments as a private iCalendar feed", async () => {
    mockCalendarFeedsRepo.findByToken.mockResolvedValue({
      groupId: GROUP_ID,
      groupName: "Hexgate Playgroup",
      kind: "tournaments",
    });
    mockTournamentsRepo.listForGroup.mockResolvedValue([
      {
        id: "t-1",
        name: "Summoner Skirmish",
        status: "running",
        startsAt: new Date("2026-09-20T15:00:00Z"),
        endsAt: null,
        updatedAt: new Date("2026-09-14T08:00:00Z"),
      },
    ]);

    const res = await app.request("/api/v1/calendar-feeds/tok_ABC-123.ics");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("private, max-age=900");
    const body = await res.text();
    expect(body).toContain("X-WR-CALNAME:Hexgate Playgroup · Tournaments");
    expect(body).toContain("UID:openrift-tournament-t-1");
    expect(body).toContain("URL:https://example.test/tournaments/t-1");
    expect(mockCalendarFeedsRepo.findByToken).toHaveBeenCalledWith("tok_ABC-123");
    expect(mockTournamentsRepo.listForGroup).toHaveBeenCalledWith(GROUP_ID);
    expect(mockShopsRepo.listFeedEvents).not.toHaveBeenCalled();
  });

  it("serves the events at the group's shops starting 30 days back", async () => {
    mockCalendarFeedsRepo.findByToken.mockResolvedValue({
      groupId: GROUP_ID,
      groupName: "Hexgate Playgroup",
      kind: "shop_events",
    });
    mockShopsRepo.listFeedEvents.mockResolvedValue([
      {
        externalId: "9911",
        name: "Nexus Night",
        startAt: new Date("2026-09-21T17:00:00Z"),
        endAtEstimate: null,
        storeName: "Piltover Games",
        location: null,
        eventFormat: null,
      },
    ]);

    const res = await app.request("/api/v1/calendar-feeds/tok.ics");

    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("X-WR-CALNAME:Hexgate Playgroup · Shop events");
    expect(body).toContain("UID:openrift-shop-event-9911");
    expect(body).toContain("LOCATION:Piltover Games");
    expect(mockShopsRepo.listFeedEvents).toHaveBeenCalledWith(GROUP_ID, 30);
    expect(mockTournamentsRepo.listForGroup).not.toHaveBeenCalled();
  });

  it("answers 404 for a token that matches no feed", async () => {
    mockCalendarFeedsRepo.findByToken.mockResolvedValue(undefined);

    const res = await app.request("/api/v1/calendar-feeds/unknown.ics");

    expect(res.status).toBe(404);
  });

  it("does not match a path without the .ics suffix", async () => {
    const res = await app.request("/api/v1/calendar-feeds/tok");

    expect(res.status).toBe(404);
    expect(mockCalendarFeedsRepo.findByToken).not.toHaveBeenCalled();
  });
});
