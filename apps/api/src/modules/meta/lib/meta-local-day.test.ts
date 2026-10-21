import { describe, expect, it } from "vitest";

import { longitudeLocalDay } from "./meta-local-day.js";

describe("longitudeLocalDay", () => {
  it("files an American evening event under the day it was played", () => {
    const startAt = new Date("2026-01-03T00:30:00.000Z");
    expect(longitudeLocalDay(startAt, -81.369)).toBe("2026-01-02");
  });

  it("keeps a European late-evening event on its own day", () => {
    const startAt = new Date("2025-10-24T18:30:00.000Z");
    expect(longitudeLocalDay(startAt, 10.33)).toBe("2025-10-24");
  });

  it("falls back to the UTC day for an event with no coordinates", () => {
    const startAt = new Date("2026-01-03T00:30:00.000Z");
    expect(longitudeLocalDay(startAt, null)).toBe("2026-01-03");
  });
});
