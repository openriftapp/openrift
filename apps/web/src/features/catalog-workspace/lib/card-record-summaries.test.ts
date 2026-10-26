import { describe, expect, it } from "vitest";

import { bansErrataSummary, historySummary } from "./card-record-summaries";

describe("bansErrataSummary", () => {
  it("says None without bans or errata", () => {
    expect(bansErrataSummary(0, false)).toBe("None");
  });

  it("counts bans and names errata", () => {
    expect(bansErrataSummary(1, true)).toBe("1 ban, errata");
    expect(bansErrataSummary(2, false)).toBe("2 bans");
    expect(bansErrataSummary(0, true)).toBe("Errata");
  });

  it("names only errata while the bans load", () => {
    expect(bansErrataSummary(undefined, true)).toBe("Errata");
    expect(bansErrataSummary(undefined, false)).toBeUndefined();
  });
});

describe("historySummary", () => {
  const now = new Date("2026-10-26T12:00:00.000Z");

  it("reads the newest event, whatever the order", () => {
    expect(
      historySummary(
        [{ createdAt: "2026-10-26T10:00:00.000Z" }, { createdAt: "2026-10-20T12:00:00.000Z" }],
        now,
      ),
    ).toBe("Updated 2h ago");
  });

  it("is empty without events", () => {
    expect(historySummary([], now)).toBeUndefined();
  });
});
