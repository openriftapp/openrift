import { describe, expect, it } from "vitest";

import { makeAdminCardDetail, makeAdminPrinting, makeCandidatePrinting } from "@/test/factories";

import {
  candidateGroupKey,
  cardFoldKeys,
  foldsFocusing,
  hasFace,
  marketplaceFocusFace,
} from "./card-page-focus";

const enFoil = makeAdminPrinting({ faceId: "face-en", finish: "foil", language: "EN" });
const jpFoil = makeAdminPrinting({ faceId: "face-jp", finish: "foil", language: "JP" });
const jpNonfoil = makeAdminPrinting({ faceId: "face-jp", finish: "nonfoil", language: "JP" });

const detail = makeAdminCardDetail({
  printings: [jpFoil, jpNonfoil, enFoil],
  candidatePrintings: [
    makeCandidatePrinting({ id: "cand-1" }),
    makeCandidatePrinting({ id: "cand-2" }),
  ],
  candidatePrintingGroups: [
    {
      mostCommonShortCode: "OGN-002",
      shortCodes: ["cand-1", "cand-2"],
      expectedPrintingId: "OGN-002",
      language: "EN",
      suggestedPrintingId: null,
    },
    {
      mostCommonShortCode: "OGN-003",
      shortCodes: ["cand-missing"],
      expectedPrintingId: "OGN-003",
      language: null,
      suggestedPrintingId: null,
    },
  ],
});

describe("cardFoldKeys", () => {
  it("lists each face once, then each new-printing group", () => {
    expect(cardFoldKeys(detail)).toEqual(["face-jp", "face-en", "cand-1", "OGN-003-1"]);
  });
});

describe("foldsFocusing", () => {
  it("collapses every key except the given faces", () => {
    expect([...foldsFocusing(detail, ["face-en"])]).toEqual(["face-jp", "cand-1", "OGN-003-1"]);
  });

  it("collapses everything for no faces", () => {
    expect(foldsFocusing(detail, []).size).toBe(4);
  });
});

describe("hasFace", () => {
  it("finds a face on any printing", () => {
    expect(hasFace(detail, "face-en")).toBe(true);
    expect(hasFace(detail, "face-zh")).toBe(false);
  });
});

describe("marketplaceFocusFace", () => {
  const printings = detail.printings;

  it("matches finish and language", () => {
    expect(marketplaceFocusFace(printings, "tcgplayer", "foil", "EN")).toBe("face-en");
  });

  it("ignores the language for Cardmarket", () => {
    expect(marketplaceFocusFace(printings, "cardmarket", "foil", "EN")).toBe("face-jp");
  });

  it("matches any language when none or an empty one is given", () => {
    expect(marketplaceFocusFace(printings, "tcgplayer", "foil")).toBe("face-jp");
    expect(marketplaceFocusFace(printings, "tcgplayer", "foil", "")).toBe("face-jp");
  });

  it("falls back to the first printing with the finish", () => {
    expect(marketplaceFocusFace(printings, "cardtrader", "nonfoil", "EN")).toBe("face-jp");
  });

  it("returns null when no printing has the finish", () => {
    expect(marketplaceFocusFace(printings, "tcgplayer", "metal", "EN")).toBeNull();
    expect(marketplaceFocusFace([], "tcgplayer", "foil")).toBeNull();
  });
});

describe("candidateGroupKey", () => {
  it("finds the group holding the candidate", () => {
    expect(candidateGroupKey(detail, "cand-2")).toBe("cand-1");
  });

  it("returns null for a candidate in no group", () => {
    expect(candidateGroupKey(detail, "cand-9")).toBeNull();
  });
});
