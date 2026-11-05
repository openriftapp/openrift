import { describe, expect, it } from "vitest";

import { changelogDayLabel } from "./changelog-day";

describe("changelogDayLabel", () => {
  it("omits the year within the current year", () => {
    expect(changelogDayLabel("2026-11-04", "2026-11-05")).toBe("NOV 4");
  });

  it("adds the year for an earlier year", () => {
    expect(changelogDayLabel("2025-11-04", "2026-11-05")).toBe("NOV 4, 2025");
  });

  it("uses the UTC day at the year boundary", () => {
    expect(changelogDayLabel("2025-12-31", "2026-01-01")).toBe("DEC 31, 2025");
    expect(changelogDayLabel("2026-01-01", "2026-01-01")).toBe("JAN 1");
  });
});
