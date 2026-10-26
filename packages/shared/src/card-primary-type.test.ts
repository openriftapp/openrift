import { describe, expect, it } from "vitest";

import { primaryCardType } from "./card-primary-type.js";

describe("primaryCardType", () => {
  it("returns the only type of a single-type card", () => {
    expect(primaryCardType(["spell"])).toBe("spell");
  });

  it("returns the first type of a multi-type card", () => {
    expect(primaryCardType(["unit", "gear"])).toBe("unit");
  });

  it("throws for a card without types", () => {
    expect(() => primaryCardType([])).toThrow("at least one type");
  });
});
