import { describe, expect, it } from "vitest";

import { Route } from "./compare";

const validateSearch = Route.options.validateSearch as unknown as {
  parse: (search: unknown) => Record<string, unknown>;
};

describe("/decks/compare search", () => {
  it("keeps both sides, whatever form each deck reference takes", () => {
    expect(validateSearch.parse({ from: "deck-1", to: "share:abc" })).toEqual({
      from: "deck-1",
      to: "share:abc",
    });
  });

  it("accepts a comparison opened with one side", () => {
    expect(validateSearch.parse({ from: "deck-1" })).toEqual({ from: "deck-1" });
  });

  it("rejects a side that is not a string", () => {
    expect(() => validateSearch.parse({ from: 1 })).toThrow();
  });
});
