import { beforeEach, describe, expect, it } from "vitest";

import { makeAdminPrinting, resetIdCounter } from "@/test/factories";

import { firstPrintingSetLabel } from "./card-overview";

beforeEach(() => {
  resetIdCounter();
});

describe("firstPrintingSetLabel", () => {
  it("takes the set of the earliest printing", () => {
    const printings = [
      makeAdminPrinting({ setName: "Proving Grounds", canonicalRank: 4 }),
      makeAdminPrinting({ setName: "Origins", canonicalRank: 1 }),
    ];
    expect(firstPrintingSetLabel(printings)).toBe("Origins");
  });

  it("falls back to the set identifier when the name is missing", () => {
    expect(firstPrintingSetLabel([makeAdminPrinting({ setName: null, setSlug: "ogn" })])).toBe(
      "ogn",
    );
  });

  it("returns nothing without printings", () => {
    expect(firstPrintingSetLabel([])).toBeNull();
  });
});
