import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "./icalendar.js";
import { escapeIcsText, foldIcsLine, icsDateTime, renderCalendar } from "./icalendar.js";

const encoder = new TextEncoder();

describe("icsDateTime", () => {
  it("formats an instant in UTC basic format without milliseconds", () => {
    expect(icsDateTime(new Date("2026-09-15T18:30:05.123Z"))).toBe("20260915T183005Z");
  });
});

describe("escapeIcsText", () => {
  it("escapes backslashes, semicolons, commas and every line break style", () => {
    expect(escapeIcsText("a\\b;c,d\ne\r\nf\rg")).toBe(String.raw`a\\b\;c\,d\ne\nf\ng`);
  });
});

describe("foldIcsLine", () => {
  it("leaves a line of exactly 75 octets alone", () => {
    const line = "x".repeat(75);
    expect(foldIcsLine(line)).toBe(line);
  });

  it("folds a long line into 75-octet lines with a leading space on each continuation", () => {
    const line = "x".repeat(160);
    const folded = foldIcsLine(line);
    expect(folded.split("\r\n").map((part) => part.length)).toEqual([75, 75, 12]);
    expect(folded.replaceAll("\r\n ", "")).toBe(line);
  });

  it("never splits a multi-byte character across lines", () => {
    const line = `SUMMARY:${"Ö".repeat(60)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replaceAll("\r\n ", "")).toBe(line);
  });
});

describe("renderCalendar", () => {
  const generatedAt = new Date("2026-09-15T12:00:00Z");

  const event: CalendarEvent = {
    uid: "openrift-tournament-1",
    start: new Date("2026-09-20T15:00:00Z"),
    end: new Date("2026-09-20T20:00:00Z"),
    summary: "Summoner Skirmish, round two",
    location: "Piltover Games",
    description: "Constructed\nhttps://example.test/tournaments/1",
    url: "https://example.test/tournaments/1",
    status: "CONFIRMED",
    lastModified: new Date("2026-09-14T08:00:00Z"),
  };

  it("writes every event property inside a VCALENDAR with CRLF line endings", () => {
    const ics = renderCalendar({ name: "Hexgate Playgroup", generatedAt, events: [event] });

    expect(ics.split("\r\n")).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//OpenRift//Group calendar feeds//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "NAME:Hexgate Playgroup",
      "X-WR-CALNAME:Hexgate Playgroup",
      "REFRESH-INTERVAL;VALUE=DURATION:PT4H",
      "X-PUBLISHED-TTL:PT4H",
      "BEGIN:VEVENT",
      "UID:openrift-tournament-1",
      "DTSTAMP:20260915T120000Z",
      "DTSTART:20260920T150000Z",
      "DTEND:20260920T200000Z",
      String.raw`SUMMARY:Summoner Skirmish\, round two`,
      "LOCATION:Piltover Games",
      String.raw`DESCRIPTION:Constructed\nhttps://example.test/tournaments/1`,
      "URL:https://example.test/tournaments/1",
      "STATUS:CONFIRMED",
      "LAST-MODIFIED:20260914T080000Z",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ]);
  });

  it("escapes the calendar name", () => {
    const ics = renderCalendar({ name: "Bandle City, North", generatedAt, events: [] });
    expect(ics).toContain(String.raw`X-WR-CALNAME:Bandle City\, North`);
  });

  it("leaves out optional properties that are not set", () => {
    const ics = renderCalendar({
      name: "Hexgate Playgroup",
      generatedAt,
      events: [{ uid: "a", start: event.start, end: null, summary: "Nexus Night" }],
    });
    expect(ics).not.toMatch(/DTEND|LOCATION|DESCRIPTION|URL|STATUS|LAST-MODIFIED/u);
  });

  it("leaves out DTEND when the end is not after the start", () => {
    const ics = renderCalendar({
      name: "Hexgate Playgroup",
      generatedAt,
      events: [{ uid: "a", start: event.start, end: event.start, summary: "Nexus Night" }],
    });
    expect(ics).not.toContain("DTEND");
  });

  it("writes a calendar without events when there are none", () => {
    const ics = renderCalendar({ name: "Hexgate Playgroup", generatedAt, events: [] });
    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
