import { beforeEach, describe, expect, it } from "vitest";

import { resetIdCounter, makeCandidatePrinting } from "@/test/factories";

import {
  buildPrintingFieldsFromCandidate,
  candidateRowSummary,
  missingPrintingFields,
  summarizeCandidatePrinting,
} from "./printing-fields";

beforeEach(() => {
  resetIdCounter();
});

describe("buildPrintingFieldsFromCandidate", () => {
  it("carries the candidate's values across", () => {
    const candidate = makeCandidatePrinting({
      shortCode: "OGN-042",
      artist: "Riot Artist",
      publicCode: "OGN-042/300",
      markerSlugs: ["prerelease"],
    });
    const fields = buildPrintingFieldsFromCandidate(candidate);
    expect(fields.shortCode).toBe("OGN-042");
    expect(fields.artist).toBe("Riot Artist");
    expect(fields.publicCode).toBe("OGN-042/300");
    expect(fields.markerSlugs).toEqual(["prerelease"]);
  });

  it("omits blank optional fields rather than sending null", () => {
    const candidate = makeCandidatePrinting({ flavorText: null, printedName: null, size: null });
    const fields = buildPrintingFieldsFromCandidate(candidate) as Record<string, unknown>;
    expect("flavorText" in fields).toBe(false);
    expect("printedName" in fields).toBe(false);
    expect("size" in fields).toBe(false);
  });

  it("lets an override win over the candidate", () => {
    const candidate = makeCandidatePrinting({ rarity: "common" });
    const fields = buildPrintingFieldsFromCandidate(candidate, { rarity: "epic" });
    expect(fields.rarity).toBe("epic");
  });
});

describe("missingPrintingFields", () => {
  it("is empty for a complete candidate", () => {
    expect(
      missingPrintingFields(buildPrintingFieldsFromCandidate(makeCandidatePrinting())),
    ).toEqual([]);
  });

  it("names each blank required field", () => {
    const candidate = makeCandidatePrinting({ artist: null, publicCode: null, setId: null });
    expect(missingPrintingFields(buildPrintingFieldsFromCandidate(candidate))).toEqual([
      "artist",
      "publicCode",
    ]);
  });

  it("misses the set when neither code names one", () => {
    const candidate = makeCandidatePrinting({ setId: null, shortCode: "", publicCode: "" });
    expect(missingPrintingFields(buildPrintingFieldsFromCandidate(candidate))).toContain("setId");
  });

  it("reads the short code and the set off the public code", () => {
    const candidate = makeCandidatePrinting({
      setId: null,
      shortCode: "whatever-the-source-called-it",
      publicCode: "VEN-R06b-EN-P",
    });
    const fields = buildPrintingFieldsFromCandidate(candidate);

    expect(fields.shortCode).toBe("VEN-R06b");
    expect(fields.setId).toBe("VEN");
  });

  it("falls back to the source's short code when it sent no public code", () => {
    const candidate = makeCandidatePrinting({ publicCode: "", shortCode: "SGN-T01" });
    const fields = buildPrintingFieldsFromCandidate(candidate);

    expect(fields.shortCode).toBe("SGN-T01");
    expect(fields.setId).toBe("SGN");
  });
});

describe("summarizeCandidatePrinting", () => {
  it("joins the details it has", () => {
    const candidate = makeCandidatePrinting({
      rarity: "epic",
      finish: "foil",
      artVariant: "alternate",
    });
    expect(summarizeCandidatePrinting(candidate)).toBe("epic · foil · alternate");
  });

  it("says so when it has none", () => {
    const candidate = makeCandidatePrinting({ rarity: null, finish: null, artVariant: null });
    expect(summarizeCandidatePrinting(candidate)).toBe("No details");
  });
});

describe("candidateRowSummary", () => {
  it("joins finish, rarity and artist", () => {
    const candidate = makeCandidatePrinting({
      finish: "foil",
      rarity: "epic",
      artist: "Riot Artist",
    });
    expect(candidateRowSummary(candidate)).toBe("foil · epic · Riot Artist");
  });

  it("says so when it has none", () => {
    const candidate = makeCandidatePrinting({ finish: null, rarity: null, artist: null });
    expect(candidateRowSummary(candidate)).toBe("No details");
  });
});
