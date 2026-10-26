import { describe, expect, it } from "vitest";

import { WORKSPACE_SORTS, workspaceSearchSchema } from "./workspace-search";

describe("workspaceSearchSchema", () => {
  it("leaves the segment unset by default", () => {
    expect(workspaceSearchSchema.parse({})).toEqual({});
  });

  it("drops an unknown segment", () => {
    expect(workspaceSearchSchema.parse({ segment: "archived" }).segment).toBeUndefined();
  });

  it("drops invalid optional params", () => {
    const search = workspaceSearchSchema.parse({ order: "random", collapsed: "yes", reason: "x" });
    expect(search.order).toBeUndefined();
    expect(search.collapsed).toBeUndefined();
    expect(search.reason).toBeUndefined();
  });

  it("keeps valid params", () => {
    expect(
      workspaceSearchSchema.parse({
        segment: "new",
        order: WORKSPACE_SORTS[0],
        provider: "provider-a",
        reason: "new-image",
        q: "jinx",
        collapsed: true,
      }),
    ).toEqual({
      segment: "new",
      order: "oldest",
      provider: "provider-a",
      reason: "new-image",
      q: "jinx",
      collapsed: true,
    });
  });

  it("keeps table filters and desk controls and drops unknown values", () => {
    expect(
      workspaceSearchSchema.parse({ filter: "no-image", status: "released", deskSort: "card" }),
    ).toEqual({ filter: "no-image", status: "released", deskSort: "card" });
    const search = workspaceSearchSchema.parse({ filter: "x", status: "y", deskSort: "z" });
    expect(search).toEqual({});
  });
});
