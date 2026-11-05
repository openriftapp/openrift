import { describe, expect, it } from "vitest";

import { formatTickDate, lastValuePoint, tickAnchor } from "./price-history-ticks";

describe("formatTickDate", () => {
  it("renders a short UTC day", () => {
    expect(formatTickDate("2026-10-06")).toMatch(/^OCT 6$/iu);
  });

  it("keeps the UTC day for an instant near midnight", () => {
    expect(formatTickDate("2026-01-01T00:30:00Z")).toMatch(/^JAN 1$/iu);
  });

  it("returns an empty string for bad input", () => {
    expect(formatTickDate("nope")).toBe("");
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
