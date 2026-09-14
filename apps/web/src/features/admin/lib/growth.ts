import type { AdminGrowthDay } from "@openrift/shared/contracts/admin/dashboard";

export const GROWTH_RANGES = ["30d", "90d", "all"] as const;

export type GrowthRange = (typeof GROWTH_RANGES)[number];

export const GROWTH_RANGE_LABELS: Record<GrowthRange, string> = {
  "30d": "30D",
  "90d": "90D",
  all: "All",
};

export const GROWTH_RANGE_CAPTIONS: Record<GrowthRange, string> = {
  "30d": "in 30 days",
  "90d": "in 90 days",
  all: "all time",
};

const RANGE_DAYS: Record<GrowthRange, number | null> = { "30d": 30, "90d": 90, all: null };

export interface GrowthPoint {
  date: string;
  total: number;
  added: number;
}

/** Sums the whole series before slicing, so a windowed view still starts at the real total. */
export function toGrowthSeries(days: AdminGrowthDay[], range: GrowthRange): GrowthPoint[] {
  let total = 0;
  const cumulative = days.map((day) => {
    total += day.count;
    return { date: day.date, total, added: day.count };
  });

  const window = RANGE_DAYS[range];
  return window === null ? cumulative : cumulative.slice(-window);
}

export function countAdded(series: GrowthPoint[]): number {
  return series.reduce((sum, point) => sum + point.added, 0);
}
