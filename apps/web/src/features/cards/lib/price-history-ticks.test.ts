import { describe, expect, it } from "vitest";

import {
  formatTickDate,
  lastValueLabelPosition,
  lastValuePoint,
  spansYears,
  tickAnchor,
} from "./price-history-ticks";

describe("formatTickDate", () => {
  it("renders a short UTC day", () => {
    expect(formatTickDate("2026-10-06")).toBe("Oct 6");
  });

  it("keeps the UTC day for an instant near midnight", () => {
    expect(formatTickDate("2026-01-01T00:30:00Z")).toBe("Jan 1");
  });

  it("adds the year when asked", () => {
    expect(formatTickDate("2025-10-06", true)).toBe("Oct 6, 2025");
  });

  it("returns an empty string for bad input", () => {
    expect(formatTickDate("nope")).toBe("");
    expect(formatTickDate("nope", true)).toBe("");
  });
});

describe("spansYears", () => {
  it("is true when the range crosses a new year", () => {
    expect(spansYears([{ date: "2025-12-20" }, { date: "2026-01-04" }])).toBe(true);
  });

  it("is false within one calendar year", () => {
    expect(spansYears([{ date: "2026-01-01" }, { date: "2026-12-31" }])).toBe(false);
  });

  it("is false for one or no points", () => {
    expect(spansYears([{ date: "2026-01-01" }])).toBe(false);
    expect(spansYears([])).toBe(false);
  });
});

describe("lastValueLabelPosition", () => {
  const points = [
    { value: 2, secondary: 1 },
    { value: 10, secondary: 8 },
    { value: null, secondary: null },
  ];

  it("keeps the label above a line that ends low in the range", () => {
    expect(lastValueLabelPosition(points, 4)).toBe("top");
  });

  it("drops the label below a line that ends near the period high", () => {
    expect(lastValueLabelPosition(points, 9)).toBe("bottom");
    expect(lastValueLabelPosition(points, 8)).toBe("top");
    expect(lastValueLabelPosition(points, 10)).toBe("bottom");
  });

  it("counts the second series toward the high", () => {
    expect(lastValueLabelPosition([{ value: 5, secondary: 20 }], 5)).toBe("top");
  });

  it("keeps the label above when every price is zero", () => {
    expect(lastValueLabelPosition([{ value: 0, secondary: null }], 0)).toBe("top");
  });
});

describe("tickAnchor", () => {
  it("anchors the edges inward", () => {
    expect(tickAnchor(0, 4)).toBe("start");
    expect(tickAnchor(3, 4)).toBe("end");
    expect(tickAnchor(1, 4)).toBe("middle");
  });

  it("starts a lone tick at the left", () => {
    expect(tickAnchor(0, 1)).toBe("start");
  });
});

describe("lastValuePoint", () => {
  it("skips trailing nulls", () => {
    const points = [{ value: 1 }, { value: 2 }, { value: null }];
    expect(lastValuePoint(points)).toBe(points[1]);
  });

  it("returns undefined when every value is null", () => {
    expect(lastValuePoint([{ value: null }])).toBeUndefined();
  });
});
