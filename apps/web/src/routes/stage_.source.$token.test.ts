import { describe, expect, it } from "vitest";

import { Route } from "./stage_.source.$token";

const validateSearch = Route.options.validateSearch as unknown as {
  parse: (search: unknown) => Record<string, unknown>;
};

describe("/stage/source/$token search", () => {
  it("keeps the preset a browser source names", () => {
    expect(validateSearch.parse({ preset: "worlds" })).toEqual({ preset: "worlds" });
  });

  it("drops a malformed preset instead of breaking the source", () => {
    expect(validateSearch.parse({ preset: 7 })).toEqual({ preset: undefined });
  });

  it("drops params it does not own", () => {
    expect(validateSearch.parse({ theme: "dark" })).toEqual({});
  });
});
