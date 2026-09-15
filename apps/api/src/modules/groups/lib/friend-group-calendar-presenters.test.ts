import { describe, expect, it } from "vitest";

import {
  calendarFeedName,
  presentShopCalendarEvent,
  presentTournamentCalendarEvent,
} from "./friend-group-calendar-presenters.js";

describe("calendarFeedName", () => {
  it("names each feed after the group and what it holds", () => {
    expect(calendarFeedName("Hexgate Playgroup", "tournaments")).toBe(
      "Hexgate Playgroup · Tournaments",
    );
    expect(calendarFeedName("Hexgate Playgroup", "shop_events")).toBe(
      "Hexgate Playgroup · Shop events",
    );
  });
});

describe("presentTournamentCalendarEvent", () => {
  const tournament = {
    id: "0199a000-0000-7000-8000-000000000001",
    name: "Summoner Skirmish",
    status: "setup" as const,
    startsAt: new Date("2026-09-20T15:00:00Z"),
    endsAt: null,
    updatedAt: new Date("2026-09-14T08:00:00Z"),
  };

  it("links the event to the tournament page", () => {
    expect(presentTournamentCalendarEvent(tournament, "https://example.test")).toEqual({
      uid: "openrift-tournament-0199a000-0000-7000-8000-000000000001",
      start: tournament.startsAt,
      end: new Date("2026-09-20T20:00:00Z"),
      summary: "Summoner Skirmish",
      description: "https://example.test/tournaments/0199a000-0000-7000-8000-000000000001",
      url: "https://example.test/tournaments/0199a000-0000-7000-8000-000000000001",
      status: "CONFIRMED",
      lastModified: tournament.updatedAt,
    });
  });

  it("marks a cancelled tournament as cancelled", () => {
    const event = presentTournamentCalendarEvent(
      { ...tournament, status: "cancelled" },
      "https://example.test",
    );
    expect(event.status).toBe("CANCELLED");
  });

  it("carries a multi-day end through", () => {
    const endsAt = new Date("2026-09-21T18:00:00Z");
    const event = presentTournamentCalendarEvent({ ...tournament, endsAt }, "https://example.test");
    expect(event.end).toBe(endsAt);
  });

  it("gives a tournament five hours when its end is not after its start", () => {
    const event = presentTournamentCalendarEvent(
      { ...tournament, endsAt: tournament.startsAt },
      "https://example.test",
    );
    expect(event.end).toEqual(new Date("2026-09-20T20:00:00Z"));
  });
});

describe("presentShopCalendarEvent", () => {
  const row = {
    externalId: "48213",
    name: "Monday Nexus Night",
    startAt: new Date("2026-09-21T17:00:00Z"),
    endAtEstimate: new Date("2026-09-21T20:00:00Z"),
    storeName: "Piltover Games",
    location: "12 Hextech Way, Berlin, 10247, DE",
    eventFormat: "Constructed",
  };

  it("places the event at the shop and links the locator listing", () => {
    expect(presentShopCalendarEvent(row)).toEqual({
      uid: "openrift-shop-event-48213",
      start: row.startAt,
      end: row.endAtEstimate,
      summary: "Monday Nexus Night",
      location: "Piltover Games, 12 Hextech Way, Berlin, 10247, DE",
      description: "Constructed\nhttps://locator.riftbound.uvsgames.com/events/48213",
      url: "https://locator.riftbound.uvsgames.com/events/48213",
    });
  });

  it("falls back to the shop name and the bare link when address and format are missing", () => {
    const event = presentShopCalendarEvent({ ...row, location: null, eventFormat: null });
    expect(event.location).toBe("Piltover Games");
    expect(event.description).toBe("https://locator.riftbound.uvsgames.com/events/48213");
  });

  it("gives an event without an estimated end five hours", () => {
    const event = presentShopCalendarEvent({ ...row, endAtEstimate: null });
    expect(event.end).toEqual(new Date("2026-09-21T22:00:00Z"));
  });
});
