import { describe, expect, it } from "vitest";

import { printingPrefillSearchSchema, printingsSearchSchema } from "./workspace-search";

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

describe("printingsSearchSchema", () => {
  it("leaves every param unset by default", () => {
    expect(printingsSearchSchema.parse({})).toEqual({});
  });

  it("drops the params of the old queue view", () => {
    expect(
      printingsSearchSchema.parse({
        segment: "new",
        order: "oldest",
        provider: "provider-a",
        reason: "new-image",
        collapsed: true,
        q: "jinx",
      }),
    ).toEqual({ q: "jinx" });
  });

  it("keeps table filters and desk controls and drops unknown values", () => {
    expect(
      printingsSearchSchema.parse({
        filter: "no-image",
        status: "released",
        deskSort: "card",
        desk: "promos",
      }),
    ).toEqual({ filter: "no-image", status: "released", deskSort: "card", desk: "promos" });
    expect(
      printingsSearchSchema.parse({ filter: "x", status: "y", deskSort: "z", desk: "everyone" }),
    ).toEqual({});
  });
});
