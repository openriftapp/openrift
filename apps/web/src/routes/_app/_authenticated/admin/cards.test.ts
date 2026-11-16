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

  it("drops a removed tab value and the removed status param", () => {
    expect(validateSearch.parse({ tab: "unmatched", status: "unchecked", q: "jinx" })).toEqual({
      q: "jinx",
    });
  });

  it("falls back to the default tab and keeps the rest of the search", () => {
    expect(validateSearch.parse({ tab: "nonsense", q: "jinx" })).toEqual({ q: "jinx" });
  });

  it("keeps an all-number query the router parsed as a number", () => {
    expect(validateSearch.parse({ q: 123 })).toEqual({ q: "123" });
  });
});
