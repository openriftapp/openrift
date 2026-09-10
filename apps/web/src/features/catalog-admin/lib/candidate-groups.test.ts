import { beforeEach, describe, expect, it } from "vitest";

import { makeAdminCardDetail, makeCandidatePrinting, resetIdCounter } from "@/test/factories";

import { unlinkedCandidatesForSource, unlinkedGroupCandidates } from "./candidate-groups";

beforeEach(() => {
  resetIdCounter();
});

describe("unlinkedCandidatesForSource", () => {
  it("keeps only the rows of that source that have no printing yet", () => {
    const detail = makeAdminCardDetail({
      candidatePrintings: [
        makeCandidatePrinting({ candidateCardId: "src-1", shortCode: "OGN-001" }),
        makeCandidatePrinting({ candidateCardId: "src-1", printingId: "prt-1" }),
        makeCandidatePrinting({ candidateCardId: "src-2", shortCode: "OGN-002" }),
      ],
    });
    expect(unlinkedCandidatesForSource(detail, "src-1").map((row) => row.shortCode)).toEqual([
      "OGN-001",
    ]);
  });
});

describe("unlinkedGroupCandidates", () => {
  it("returns every unlinked row of the group across sources", () => {
    const gallery = makeCandidatePrinting({ candidateCardId: "src-1" });
    const scanner = makeCandidatePrinting({ candidateCardId: "src-2" });
    const linked = makeCandidatePrinting({ candidateCardId: "src-3", printingId: "prt-1" });
    const detail = makeAdminCardDetail({
      candidatePrintings: [gallery, scanner, linked],
      candidatePrintingGroups: [
        {
          mostCommonShortCode: "OGN-001",
          shortCodes: [gallery.id, scanner.id, linked.id],
          expectedPrintingId: "OGN-001:foil",
          language: "en",
          suggestedPrintingId: null,
        },
      ],
    });
    expect(unlinkedGroupCandidates(detail, gallery.id).map((row) => row.id)).toEqual([
      gallery.id,
      scanner.id,
    ]);
  });

  it("falls back to the row itself when no group holds it", () => {
    const solo = makeCandidatePrinting({ candidateCardId: "src-1" });
    const detail = makeAdminCardDetail({ candidatePrintings: [solo] });
    expect(unlinkedGroupCandidates(detail, solo.id).map((row) => row.id)).toEqual([solo.id]);
  });
});
