import { describe, expect, it } from "vitest";

import { lastActiveBucket } from "./user-profile-presenters.js";

const NOW = new Date("2026-09-11T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000);

describe("lastActiveBucket", () => {
  it("returns null without any session", () => {
    expect(lastActiveBucket(null, NOW)).toBeNull();
  });

  it("buckets by age with the boundary falling into the older bucket", () => {
    expect(lastActiveBucket(hoursAgo(0), NOW)).toBe("today");
    expect(lastActiveBucket(hoursAgo(23), NOW)).toBe("today");
    expect(lastActiveBucket(hoursAgo(24), NOW)).toBe("week");
    expect(lastActiveBucket(hoursAgo(24 * 7 - 1), NOW)).toBe("week");
    expect(lastActiveBucket(hoursAgo(24 * 7), NOW)).toBe("month");
    expect(lastActiveBucket(hoursAgo(24 * 30 - 1), NOW)).toBe("month");
    expect(lastActiveBucket(hoursAgo(24 * 30), NOW)).toBe("older");
    expect(lastActiveBucket(hoursAgo(24 * 400), NOW)).toBe("older");
  });
});
