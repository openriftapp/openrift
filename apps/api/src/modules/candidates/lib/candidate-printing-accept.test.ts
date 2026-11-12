import { describe, expect, it } from "vitest";

import { candidatePrintingRow as cp } from "../../../test/candidate-printing-row.js";
import {
  acceptFieldsFromCandidate,
  candidateAcceptKey,
  candidatePrintingLabel,
  groupCandidatePrintings,
} from "./candidate-printing-accept.js";

describe("acceptFieldsFromCandidate", () => {
  it("fills defaults for missing optional fields", () => {
    const result = acceptFieldsFromCandidate(cp("a"));
    expect(result.fields).toMatchObject({
      artVariant: "normal",
      isSigned: false,
      isOvernumbered: false,
      size: "standard",
      language: "EN",
      publicCode: "OGN-027/298",
    });
  });

  it("infers the finish from the rarity", () => {
    expect(
      acceptFieldsFromCandidate(cp("a", { finish: null, rarity: "common" })).fields?.finish,
    ).toBe("normal");
    expect(
      acceptFieldsFromCandidate(cp("a", { finish: null, rarity: "epic" })).fields?.finish,
    ).toBe("foil");
  });

  it("requires a public code", () => {
    expect(acceptFieldsFromCandidate(cp("a", { publicCode: null })).missing).toEqual([
      "publicCode",
    ]);
  });

  it("lists every missing required field, finish only when the rarity cannot supply it", () => {
    const result = acceptFieldsFromCandidate(
      cp("a", { setId: null, rarity: null, finish: null, artist: null, publicCode: null }),
    );
    expect(result.missing).toEqual(["setId", "rarity", "finish", "artist", "publicCode"]);
  });
});

describe("candidateAcceptKey", () => {
  it("matches a stated finish with the one the rarity implies", () => {
    expect(candidateAcceptKey(cp("a", { finish: null, rarity: "common" }))).toBe(
      candidateAcceptKey(cp("b", { finish: "normal", rarity: "common" })),
    );
  });

  it("ignores short-code case and marker order", () => {
    expect(candidateAcceptKey(cp("a", { shortCode: "ogn-027", markerSlugs: ["b", "a"] }))).toBe(
      candidateAcceptKey(cp("b", { shortCode: "OGN-027", markerSlugs: ["a", "b"] })),
    );
  });

  it("separates sizes and defaults a missing language to English", () => {
    expect(candidateAcceptKey(cp("a", { size: "oversized" }))).not.toBe(
      candidateAcceptKey(cp("b", { size: null })),
    );
    expect(candidateAcceptKey(cp("a", { language: null }))).toBe(
      candidateAcceptKey(cp("b", { language: "EN" })),
    );
  });
});

describe("groupCandidatePrintings", () => {
  it("groups candidates of one printing identity", () => {
    const groups = groupCandidatePrintings([
      cp("a"),
      cp("b", { finish: "foil" }),
      cp("c", { shortCode: "ogn-027" }),
    ]);
    expect(groups.map((group) => group.map((row) => row.id))).toEqual([["a", "c"], ["b"]]);
  });
});

describe("candidatePrintingLabel", () => {
  it("uses the resolved finish and defaults the language to English", () => {
    expect(candidatePrintingLabel(cp("a", { finish: null, rarity: "rare", language: null }))).toBe(
      "OGN-027 foil EN",
    );
  });

  it("leaves out a finish nothing can supply", () => {
    expect(candidatePrintingLabel(cp("a", { finish: null, rarity: null }))).toBe("OGN-027 EN");
  });

  it("names a non-standard size and leaves the standard one out", () => {
    expect(candidatePrintingLabel(cp("a", { size: "oversized" }))).toBe(
      "OGN-027 normal EN oversized",
    );
    expect(candidatePrintingLabel(cp("a", { size: "standard" }))).toBe("OGN-027 normal EN");
  });
});
