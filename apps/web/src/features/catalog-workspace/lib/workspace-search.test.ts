import { describe, expect, it } from "vitest";

import {
  printingPrefillSearchSchema,
  WORKSPACE_SORTS,
  workspaceSearchSchema,
} from "./workspace-search";

describe("printingPrefillSearchSchema", () => {
  it("keeps a card, language and finish", () => {
    expect(
      printingPrefillSearchSchema.parse({
        card: "seraphine-not-alone",
        language: "FR",
        finish: "foil",
      }),
    ).toEqual({ card: "seraphine-not-alone", language: "FR", finish: "foil" });
  });

  it("leaves a plain create link without a prefill", () => {
    expect(printingPrefillSearchSchema.parse({})).toEqual({});
  });

  it("keeps a uuid to duplicate from and drops anything else", () => {
    const id = "019a0000-0000-7000-8000-000000000001";
    expect(printingPrefillSearchSchema.parse({ card: "jinx", duplicateFrom: id })).toEqual({
      card: "jinx",
      duplicateFrom: id,
    });
    expect(printingPrefillSearchSchema.parse({ duplicateFrom: "printing-1" })).toEqual({});
  });

  it("drops empty and non-string values", () => {
    expect(printingPrefillSearchSchema.parse({ card: "", language: true, finish: null })).toEqual(
      {},
    );
  });
});

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
