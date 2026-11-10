import { describe, expect, it } from "vitest";

import { Route } from "./contribute_.card_.$cardSlug_.printing_.$printingId_.image";

const validateSearch = Route.options.validateSearch as unknown as {
  parse: (search: unknown) => Record<string, unknown>;
};

describe("/contribute/card/$cardSlug/printing/$printingId/image search", () => {
  it("keeps the second side however the URL spells it", () => {
    expect(validateSearch.parse({ side: 2 })).toEqual({ side: 2 });
    expect(validateSearch.parse({ side: "2" })).toEqual({ side: 2 });
  });

  it("drops any other side instead of failing the page", () => {
    expect(validateSearch.parse({ side: "1" }).side).toBeUndefined();
    expect(validateSearch.parse({ side: null }).side).toBeUndefined();
  });

  it("leaves the side absent when the link names none", () => {
    expect(validateSearch.parse({})).toEqual({});
  });
});
