import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { distinctPrintingCode, printingCollectionSearch } from "./printing-search-link";

const recruit = {
  faceId: "face-recruit",
  cardId: "recruit",
  cardName: "Recruit",
  cardSlug: "recruit",
  shortCode: "OGN-271",
};

describe("distinctPrintingCode", () => {
  it("keeps a numbered short code", () => {
    expect(distinctPrintingCode(stubPrinting({ shortCode: "OGN-042" }))).toBe("OGN-042");
  });

  it("names a token side by its paired side's code", () => {
    expect(distinctPrintingCode(stubPrinting({ shortCode: "OGN", otherSide: recruit }))).toBe(
      "OGN-271",
    );
  });

  it("keeps a bare code without another side", () => {
    expect(distinctPrintingCode(stubPrinting({ shortCode: "OGN" }))).toBe("OGN");
  });
});

describe("printingCollectionSearch", () => {
  it("narrows to the printing's code, finish and language", () => {
    expect(
      printingCollectionSearch(
        stubPrinting({ shortCode: "OGN", otherSide: recruit, finish: "foil", language: "FR" }),
      ),
    ).toEqual({ search: "id:OGN-271", view: "printings", finishes: ["foil"], languages: ["FR"] });
  });
});
