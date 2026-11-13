import { describe, expect, it } from "vitest";

import { parseIntegerFields, parseIntegerInput } from "./integer-input";

describe("parseIntegerFields", () => {
  it("keeps filled fields and leaves blank ones out", () => {
    expect(parseIntegerFields({ might: "3", energy: " ", power: "0" })).toEqual({
      might: 3,
      power: 0,
    });
  });

  it("rejects the whole set when one field is not a whole number", () => {
    expect(parseIntegerFields({ might: "3", energy: "1.5" })).toBeUndefined();
  });
});

describe("parseIntegerInput", () => {
  it("reads blank text as no value", () => {
    expect(parseIntegerInput("")).toBeNull();
    expect(parseIntegerInput("   ")).toBeNull();
  });

  it("reads whole numbers, trimmed and signed", () => {
    expect(parseIntegerInput(" 3 ")).toBe(3);
    expect(parseIntegerInput("-1")).toBe(-1);
    expect(parseIntegerInput("0")).toBe(0);
  });

  it("rejects a number below the minimum", () => {
    expect(parseIntegerInput("0", 1)).toBeUndefined();
    expect(parseIntegerInput("1", 1)).toBe(1);
    expect(parseIntegerInput("", 1)).toBeNull();
  });

  it("rejects anything that is not a whole number", () => {
    expect(parseIntegerInput("3abc")).toBeUndefined();
    expect(parseIntegerInput("1.5")).toBeUndefined();
    expect(parseIntegerInput("1e3")).toBeUndefined();
    expect(parseIntegerInput("-")).toBeUndefined();
  });
});
