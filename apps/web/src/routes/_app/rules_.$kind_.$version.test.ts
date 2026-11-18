import { describe, expect, it } from "vitest";

import { Route as VersionRoute } from "./rules_.$kind_.$version";
import { Route as InfractionsRoute } from "./rules_.$kind_.$version_.infractions";

type DepsFn = (ctx: { search: Record<string, unknown> }) => Record<string, unknown>;

describe("rules version loader deps", () => {
  it.each([
    ["the rulebook", VersionRoute.options.loaderDeps],
    ["the infractions view", InfractionsRoute.options.loaderDeps],
  ])("leaves the search query out for %s, so typing does not reload", (_label, loaderDeps) => {
    const deps = (loaderDeps as unknown as DepsFn)({
      search: { q: "trigger", lang: "en", penalty: "warning" },
    });
    expect(deps).not.toHaveProperty("q");
    expect(deps).toMatchObject({ lang: "en" });
  });
});
