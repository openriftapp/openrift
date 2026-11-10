import { describe, expect, it } from "vitest";

import { Route } from "./cards";

const validateSearch = Route.options.validateSearch as unknown as {
  parse: (search: unknown) => Record<string, unknown>;
};

describe("/admin/cards search", () => {
  it("keeps the tab, issue and scope a link carries", () => {
    expect(
      validateSearch.parse({
        tab: "attention",
        issue: "unlinked-products",
        priceScope: "cardtrader:FR",
        q: "jinx",
      }),
    ).toEqual({
      tab: "attention",
      issue: "unlinked-products",
      priceScope: "cardtrader:FR",
      q: "jinx",
    });
  });

  it("still validates the older tab and status values", () => {
    expect(validateSearch.parse({ tab: "unmatched", status: "unchecked" })).toEqual({
      tab: "unmatched",
      status: "unchecked",
    });
  });

  it("rejects an unknown tab", () => {
    expect(() => validateSearch.parse({ tab: "nonsense" })).toThrow();
  });
});
