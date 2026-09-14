import { describe, expect, it } from "vitest";

import { countAdded, toGrowthSeries } from "@/features/admin/lib/growth";

const series = [
  { date: "2026-01-01", count: 2 },
  { date: "2026-01-02", count: 0 },
  { date: "2026-01-03", count: 3 },
];

describe("toGrowthSeries", () => {
  it("accumulates daily counts into a running total", () => {
    expect(toGrowthSeries(series, "all")).toEqual([
      { date: "2026-01-01", total: 2, added: 2 },
      { date: "2026-01-02", total: 2, added: 0 },
      { date: "2026-01-03", total: 5, added: 3 },
    ]);
  });

  it("keeps the real total on a windowed range instead of restarting at zero", () => {
    const window = toGrowthSeries(series, "30d");
    expect(window).toHaveLength(3);

    const long = Array.from({ length: 40 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 1, 1 + i)).toISOString().slice(0, 10),
      count: 1,
    }));
    const tail = toGrowthSeries(long, "30d");
    expect(tail).toHaveLength(30);
    expect(tail.at(0)?.total).toBe(11);
    expect(tail.at(-1)?.total).toBe(40);
  });

  it("returns nothing for an empty series", () => {
    expect(toGrowthSeries([], "all")).toEqual([]);
    expect(toGrowthSeries([], "90d")).toEqual([]);
  });
});

describe("countAdded", () => {
  it("sums the additions in the given window", () => {
    expect(countAdded(toGrowthSeries(series, "all"))).toBe(5);
    expect(countAdded([])).toBe(0);
  });
});
