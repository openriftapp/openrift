import { describe, expect, it } from "vitest";

import { Route } from "./$slug_.lists.$listId";

const validateSearch = Route.options.validateSearch as unknown as {
  parse: (search: unknown) => Record<string, unknown>;
};

describe("/groups/$slug/lists/$listId search", () => {
  it("keeps the shared filter params next to the member it came from", () => {
    expect(validateSearch.parse({ q: "ekko", sets: ["ogn"], fromUser: "u-1" })).toMatchObject({
      q: "ekko",
      sets: ["ogn"],
      fromUser: "u-1",
    });
  });

  it("drops a malformed member instead of failing the list", () => {
    expect(validateSearch.parse({ fromUser: 3 }).fromUser).toBeUndefined();
  });
});
