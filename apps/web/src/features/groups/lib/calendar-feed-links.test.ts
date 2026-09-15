import { describe, expect, it } from "vitest";

import { calendarFeedUrl, googleCalendarSubscribeUrl, webcalUrl } from "./calendar-feed-links";

describe("calendar feed links", () => {
  const feedUrl = calendarFeedUrl("https://example.test", "abc_DEF-123");

  it("points at the API feed for the token", () => {
    expect(feedUrl).toBe("https://example.test/api/v1/calendar-feeds/abc_DEF-123.ics");
  });

  it("swaps the scheme for webcal so calendar apps subscribe", () => {
    expect(webcalUrl(feedUrl)).toBe("webcal://example.test/api/v1/calendar-feeds/abc_DEF-123.ics");
    expect(webcalUrl("http://localhost:5173/api/v1/calendar-feeds/t.ics")).toBe(
      "webcal://localhost:5173/api/v1/calendar-feeds/t.ics",
    );
  });

  it("hands Google Calendar the encoded webcal address", () => {
    expect(googleCalendarSubscribeUrl(feedUrl)).toBe(
      "https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fexample.test%2Fapi%2Fv1%2Fcalendar-feeds%2Fabc_DEF-123.ics",
    );
  });
});
