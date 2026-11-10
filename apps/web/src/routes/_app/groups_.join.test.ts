import { describe, expect, it } from "vitest";

import { Route } from "./groups_.join";

const validateSearch = Route.options.validateSearch as unknown as (
  search: unknown,
) => Record<string, unknown>;

describe("/groups/join search", () => {
  it("keeps the invite code", () => {
    expect(validateSearch({ code: "BARON-NASHOR" })).toEqual({ code: "BARON-NASHOR" });
  });

  it("accepts a link without a code", () => {
    expect(validateSearch({})).toEqual({});
  });

  it("rejects a code that is not a string", () => {
    expect(() => validateSearch({ code: 42 })).toThrow();
  });
});
