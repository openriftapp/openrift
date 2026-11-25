import { describe, expect, it } from "vitest";

import { stubInitResponse } from "@/test/init-fixtures";

import { legalityContextFor } from "./viewer-legality";

function init() {
  return {
    ...stubInitResponse(),
    circuits: [{ slug: "korea", label: "Korea", countryCodes: ["KR"] }],
    formatSets: [{ formatId: "standard", setSlug: "OGN", legalFrom: "2025-10-31" }],
  };
}

describe("legalityContextFor", () => {
  it("carries a known circuit and the set windows", () => {
    const data = init();
    expect(legalityContextFor(data, "korea")).toEqual({
      circuit: "korea",
      windows: data.formatSets,
    });
  });

  it("falls back to the global list for the global value or an unknown slug", () => {
    const data = init();
    expect(legalityContextFor(data, "global").circuit).toBeUndefined();
    expect(legalityContextFor(data, "atlantis").circuit).toBeUndefined();
  });

  it("returns the same context for the same init payload and circuit", () => {
    const data = init();
    expect(legalityContextFor(data, "korea")).toBe(legalityContextFor(data, "korea"));
    expect(legalityContextFor(init(), "korea")).not.toBe(legalityContextFor(data, "korea"));
  });
});
