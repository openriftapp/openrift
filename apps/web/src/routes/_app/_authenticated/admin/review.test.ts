import { describe, expect, it } from "vitest";

import { Route } from "./review";

const validateSearch = Route.options.validateSearch as unknown as {
  parse: (search: unknown) => Record<string, unknown>;
};

describe("/admin/review search", () => {
  it("keeps the filter and the query", () => {
    expect(validateSearch.parse({ filter: "contributors", q: "ahri" })).toEqual({
      filter: "contributors",
      q: "ahri",
    });
  });

  it("accepts an untouched queue as an empty search", () => {
    expect(validateSearch.parse({})).toEqual({});
  });

  it("rejects an unknown filter", () => {
    expect(() => validateSearch.parse({ filter: "everything" })).toThrow();
  });
});
