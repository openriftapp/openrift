import { describe, expect, it } from "vitest";

import { Route } from "./printings";

const validateSearch = Route.options.validateSearch as unknown as {
  parse: (search: unknown) => Record<string, unknown>;
};

describe("/admin/workspace/printings search", () => {
  it("keeps the desk next to the workspace params", () => {
    expect(validateSearch.parse({ desk: "promos", segment: "open", filter: "promo" })).toEqual({
      desk: "promos",
      segment: "open",
      filter: "promo",
    });
  });

  it("drops an unknown desk instead of failing the page", () => {
    expect(validateSearch.parse({ desk: "everyone" }).desk).toBeUndefined();
  });
});
