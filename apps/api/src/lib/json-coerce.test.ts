import { describe, expect, it } from "vitest";

import { coord, count, instant, record, recordCapped, sourceId, text } from "./json-coerce.js";

describe("record", () => {
  it("returns a plain object", () => {
    const value = { a: 1 };
    expect(record(value)).toBe(value);
  });

  it("rejects arrays, null and primitives", () => {
    expect(record([])).toBeNull();
    expect(record(null)).toBeNull();
    expect(record("x")).toBeNull();
  });
});

describe("text", () => {
  it("trims strings and stringifies finite numbers", () => {
    expect(text("  Summoner Skirmish ")).toBe("Summoner Skirmish");
    expect(text(42)).toBe("42");
  });

  it("rejects blank strings, non-finite numbers and other types", () => {
    expect(text("   ")).toBeNull();
    expect(text(Number.NaN)).toBeNull();
    expect(text(true)).toBeNull();
  });
});

describe("count", () => {
  it("accepts non-negative integers", () => {
    expect(count(0)).toBe(0);
    expect(count(8)).toBe(8);
  });

  it("rejects negatives, fractions and strings", () => {
    expect(count(-1)).toBeNull();
    expect(count(1.5)).toBeNull();
    expect(count("3")).toBeNull();
  });
});

describe("coord", () => {
  it("accepts finite numbers including negatives", () => {
    expect(coord(-122.5)).toBe(-122.5);
  });

  it("rejects non-finite numbers and strings", () => {
    expect(coord(Number.POSITIVE_INFINITY)).toBeNull();
    expect(coord("1")).toBeNull();
  });
});

describe("sourceId", () => {
  it("accepts positive integers", () => {
    expect(sourceId(17)).toBe(17);
  });

  it("rejects zero, fractions and strings", () => {
    expect(sourceId(0)).toBeNull();
    expect(sourceId(2.5)).toBeNull();
    expect(sourceId("17")).toBeNull();
  });
});

describe("instant", () => {
  it("parses a date string", () => {
    expect(instant("2026-08-15T10:00:00Z")?.toISOString()).toBe("2026-08-15T10:00:00.000Z");
  });

  it("rejects unparseable and blank values", () => {
    expect(instant("not a date")).toBeNull();
    expect(instant("")).toBeNull();
    expect(instant(null)).toBeNull();
  });
});

describe("recordCapped", () => {
  it("appends messages below the cap", () => {
    const errors = ["a"];
    recordCapped(errors, ["b", "c"]);
    expect(errors).toEqual(["a", "b", "c"]);
  });

  it("stops at the cap", () => {
    const errors = ["a"];
    recordCapped(errors, ["b", "c", "d"], 2);
    expect(errors).toEqual(["a", "b"]);
  });

  it("defaults the cap to 50", () => {
    const errors: string[] = [];
    recordCapped(
      errors,
      Array.from({ length: 60 }, (_, index) => String(index)),
    );
    expect(errors).toHaveLength(50);
  });
});
