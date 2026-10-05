import { describe, expect, it } from "vitest";

import {
  mergeFields,
  pickBoolean,
  pickEnum,
  pickEnumArray,
  pickNumber,
  pickString,
  pickStringArray,
} from "./persist-merge";

describe("pickBoolean", () => {
  it("keeps booleans and rejects everything else", () => {
    expect(pickBoolean(true)).toBe(true);
    expect(pickBoolean(false)).toBe(false);
    expect(pickBoolean("true")).toBeUndefined();
    expect(pickBoolean(1)).toBeUndefined();
    expect(pickBoolean(undefined)).toBeUndefined();
  });
});

describe("pickString", () => {
  it("keeps strings, including empty ones, and rejects everything else", () => {
    expect(pickString("2026-10-04")).toBe("2026-10-04");
    expect(pickString("")).toBe("");
    expect(pickString(null)).toBeUndefined();
    expect(pickString(42)).toBeUndefined();
  });
});

describe("pickNumber", () => {
  it("keeps finite numbers and rejects everything else", () => {
    expect(pickNumber(3)).toBe(3);
    expect(pickNumber(0)).toBe(0);
    expect(pickNumber(Number.NaN)).toBeUndefined();
    expect(pickNumber(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(pickNumber("3")).toBeUndefined();
  });
});

describe("pickStringArray", () => {
  it("keeps the string entries of an array", () => {
    expect(pickStringArray(["a", 1, "b", null])).toEqual(["a", "b"]);
    expect(pickStringArray([])).toEqual([]);
  });

  it("rejects a non-array", () => {
    expect(pickStringArray("a")).toBeUndefined();
    expect(pickStringArray({ 0: "a" })).toBeUndefined();
  });
});

describe("pickEnum", () => {
  const pickDensity = pickEnum(["grid", "list"] as const);

  it("keeps an allowed value", () => {
    expect(pickDensity("list")).toBe("list");
  });

  it("rejects an unknown value or a non-string", () => {
    expect(pickDensity("table")).toBeUndefined();
    expect(pickDensity(0)).toBeUndefined();
  });
});

describe("pickEnumArray", () => {
  const pickFields = pickEnumArray(["name", "text", "artist"] as const);

  it("keeps the allowed entries in order", () => {
    expect(pickFields(["text", "name"])).toEqual(["text", "name"]);
  });

  it("drops unknown entries", () => {
    expect(pickFields(["name", "flavor", 3])).toEqual(["name"]);
  });

  it("rejects an array with nothing valid left, and a non-array", () => {
    expect(pickFields(["flavor"])).toBeUndefined();
    expect(pickFields([])).toBeUndefined();
    expect(pickFields("name")).toBeUndefined();
  });
});

describe("mergeFields", () => {
  interface State {
    density: "grid" | "list";
    dismissedDate: string | null;
    showImages: boolean;
    setDensity: (value: "grid" | "list") => void;
  }
  const setDensity = () => {};
  const current: State = { density: "grid", dismissedDate: null, showImages: true, setDensity };
  const merge = mergeFields<State>({
    density: pickEnum(["grid", "list"]),
    dismissedDate: pickString,
    showImages: pickBoolean,
  });

  it("takes every valid persisted field", () => {
    expect(
      merge({ density: "list", dismissedDate: "2026-10-04", showImages: false }, current),
    ).toEqual({
      density: "list",
      dismissedDate: "2026-10-04",
      showImages: false,
      setDensity,
    });
  });

  it("keeps the current value for an invalid or missing field", () => {
    expect(merge({ density: "table", showImages: "no" }, current)).toEqual(current);
  });

  it("ignores persisted keys the spec does not list", () => {
    expect(merge({ setDensity: "oops", legacyFilter: ["x"] }, current)).toEqual(current);
  });

  it("returns the current state for a missing or malformed blob", () => {
    expect(merge(undefined, current)).toBe(current);
    expect(merge(null, current)).toBe(current);
    expect(merge("grid", current)).toBe(current);
  });

  it("does not mutate the current state", () => {
    merge({ density: "list" }, current);

    expect(current.density).toBe("grid");
  });
});
