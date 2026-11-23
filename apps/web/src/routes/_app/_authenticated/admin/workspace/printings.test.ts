import { describe, expect, it } from "vitest";

import { Route } from "./printings";

const validateSearch = Route.options.validateSearch as unknown as {
  parse: (search: unknown) => Record<string, unknown>;
};

describe("/admin/workspace/printings search", () => {
  it("keeps the desk next to the table params", () => {
    expect(validateSearch.parse({ desk: "promos", q: "jinx", filter: "promo" })).toEqual({
      desk: "promos",
      q: "jinx",
      filter: "promo",
    });
  });

  it("drops an unknown desk and old queue params instead of failing the page", () => {
    expect(validateSearch.parse({ desk: "everyone", segment: "open" })).toEqual({});
  });
});
