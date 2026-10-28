import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";
import { beforeEach, describe, expect, it } from "vitest";

import { makeAdminPrinting, resetIdCounter } from "@/test/factories";

import { firstPrintingSetLabel, groupAdminPrintingDesigns } from "./card-overview";

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

describe("groupAdminPrintingDesigns", () => {
  function printing(
    shortCode: string,
    language: string,
    overrides: Partial<AdminPrintingResponse> = {},
  ) {
    return makeAdminPrinting({ setId: "ogn", shortCode, language, ...overrides });
  }

  function codes(printings: AdminPrintingResponse[]) {
    return groupAdminPrintingDesigns(printings).designs.map((design) => [
      design.lead.shortCode,
      [...design.byLanguage.keys()],
    ]);
  }

  it("merges printings that differ only in language", () => {
    const printings = [
      printing("OGN-271", "EN"),
      printing("OGN-272", "EN"),
      printing("OGN-271", "ZH"),
    ];
    expect(codes(printings)).toEqual([
      ["OGN-271", ["EN", "ZH"]],
      ["OGN-272", ["EN"]],
    ]);
    expect(groupAdminPrintingDesigns(printings).languages).toEqual(["EN", "ZH"]);
  });

  it("keeps finishes, markers and sides apart", () => {
    const printings = [
      printing("OGN-271", "EN"),
      printing("OGN-271", "EN", { finish: "foil" }),
      printing("OGN-271", "EN", { markerSlugs: ["promo"] }),
      printing("OGN-271", "EN", { side: 2 }),
    ];
    expect(codes(printings)).toHaveLength(4);
  });

  it("ignores marker order", () => {
    const printings = [
      printing("OGN-271", "EN", { markerSlugs: ["a", "b"] }),
      printing("OGN-271", "ZH", { markerSlugs: ["b", "a"] }),
    ];
    expect(codes(printings)).toEqual([["OGN-271", ["EN", "ZH"]]]);
  });
});
