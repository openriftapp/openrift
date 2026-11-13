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

  it("falls back to the default filter and keeps the query", () => {
    expect(validateSearch.parse({ filter: "everything", q: "ahri" })).toEqual({ q: "ahri" });
  });

  it("keeps an all-number query the router parsed as a number", () => {
    expect(validateSearch.parse({ q: 123 })).toEqual({ q: "123" });
  });
});
