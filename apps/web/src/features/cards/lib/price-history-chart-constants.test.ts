import { describe, expect, it } from "vitest";

import {
  availableTimeRanges,
  effectiveTimeRange,
  snapshotSpanDays,
} from "./price-history-chart-constants";

const values = (ranges: readonly { value: string }[]) => ranges.map((range) => range.value);

describe("snapshotSpanDays", () => {
  it("counts the days between the first and last snapshot", () => {
    expect(snapshotSpanDays([{ date: "2026-01-01" }, { date: "2026-02-15" }])).toBe(45);
  });

  it("is unknown with fewer than two snapshots", () => {
    expect(snapshotSpanDays([{ date: "2026-01-01" }])).toBeNull();
    expect(snapshotSpanDays()).toBeNull();
  });
});

describe("availableTimeRanges", () => {
  it("hides ranges longer than the history but keeps all", () => {
    expect(values(availableTimeRanges(45))).toEqual(["7d", "30d", "all"]);
  });

  it("offers every range while the span is unknown", () => {
    expect(values(availableTimeRanges(null))).toEqual(["7d", "30d", "90d", "all"]);
  });

  it("limits the choice to the allowed ranges", () => {
    expect(values(availableTimeRanges(400, ["30d", "all"]))).toEqual(["30d", "all"]);
  });
});

describe("effectiveTimeRange", () => {
  it("falls back to all when the chosen range is not offered", () => {
    const offered = availableTimeRanges(10);
    expect(effectiveTimeRange("90d", offered)).toBe("all");
    expect(effectiveTimeRange("7d", offered)).toBe("7d");
  });
});
