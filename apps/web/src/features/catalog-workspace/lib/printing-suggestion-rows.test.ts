import type { StagedProductResponse } from "@openrift/shared/types/api/admin";
import { beforeEach, describe, expect, it } from "vitest";

import {
  makeAdminCardDetail,
  makeAdminPrinting,
  makeCandidateCard,
  makeCandidatePrinting,
  resetIdCounter,
} from "@/test/factories";

import {
  buildPrintingSuggestions,
  listingSuggestionsForPrinting,
  printingCompareGroups,
} from "./printing-suggestion-rows";

const CONTEXT = { costKeywords: [], setTotals: {} };

beforeEach(() => {
  resetIdCounter();
});

describe("buildPrintingSuggestions", () => {
  it("returns an empty model when no detail carries the printing", () => {
    expect(buildPrintingSuggestions([makeAdminCardDetail()], "p1", CONTEXT).printing).toBeNull();
  });

  it("lists only printing-level differences", () => {
    const source = makeCandidateCard({ provider: "provider-a" });
    const candidate = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "p1",
      size: "oversized",
      artist: "Someone Else",
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [makeAdminPrinting({ id: "p1" })],
      candidatePrintings: [candidate],
    });

    const model = buildPrintingSuggestions([detail], "p1", CONTEXT);

    expect(model.suggestions.map((entry) => entry.field)).toEqual(["size"]);
    expect(model.sources).toEqual([
      expect.objectContaining({
        candidatePrintingId: candidate.id,
        differences: 1,
        elsewhere: "1 face field",
      }),
    ]);
    expect(model.enterCandidateIds).toEqual([]);
  });

  it("checks a source on Enter only when it differs on printing fields alone", () => {
    const source = makeCandidateCard({ provider: "provider-a" });
    const sizeOnly = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "p1",
      size: "oversized",
    });
    const withImage = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "p1",
      size: "oversized",
      imageUrl: "https://img.example/new.png",
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [makeAdminPrinting({ id: "p1" })],
      candidatePrintings: [sizeOnly, withImage],
    });

    const model = buildPrintingSuggestions([detail], "p1", CONTEXT);

    expect(model.sources.map((entry) => [entry.candidatePrintingId, entry.elsewhere])).toEqual([
      [sizeOnly.id, null],
      [withImage.id, "1 image"],
    ]);
    expect(model.enterCandidateIds).toEqual([sizeOnly.id]);
  });

  it("counts a candidate once when both faces' cards carry it", () => {
    const source = makeCandidateCard({ provider: "provider-a" });
    const candidate = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "p1",
      distributionChannelSlugs: ["summoner-skirmish"],
    });
    const first = makeAdminCardDetail({
      sources: [source],
      printings: [makeAdminPrinting({ id: "p1", faceId: "f1" })],
      candidatePrintings: [candidate],
    });
    const second = makeAdminCardDetail({
      sources: [source],
      printings: [makeAdminPrinting({ id: "p1", side: 2, faceId: "f2" })],
      candidatePrintings: [candidate],
    });

    const model = buildPrintingSuggestions([first, second], "p1", CONTEXT);

    expect(model.suggestions).toHaveLength(1);
  });

  it("leaves matching rows and contributor rows out of Enter", () => {
    const provider = makeCandidateCard({ provider: "provider-a" });
    const contributor = makeCandidateCard({ provider: "usersubmission" });
    const matching = makeCandidatePrinting({ candidateCardId: provider.id, printingId: "p1" });
    const proposal = makeCandidatePrinting({
      candidateCardId: contributor.id,
      printingId: "p1",
      size: "oversized",
    });
    const detail = makeAdminCardDetail({
      sources: [provider, contributor],
      printings: [makeAdminPrinting({ id: "p1" })],
      candidatePrintings: [matching, proposal],
    });

    const model = buildPrintingSuggestions([detail], "p1", CONTEXT);

    expect(model.sources.map((entry) => [entry.candidatePrintingId, entry.differences])).toEqual([
      [matching.id, 0],
      [proposal.id, 1],
    ]);
    expect(model.suggestions[0]?.isContributor).toBe(true);
    expect(model.enterCandidateIds).toEqual([]);
  });
});

describe("listingSuggestionsForPrinting", () => {
  function product(externalId: number): StagedProductResponse {
    return { externalId, finish: "normal", language: null } as StagedProductResponse;
  }
  const keyOf = (entry: { marketplace: string; product: StagedProductResponse }) =>
    `${entry.marketplace}:${entry.product.externalId}`;

  it("keeps unassigned listings that suggest this printing, strongest first", () => {
    const entries = [
      { marketplace: "tcgplayer" as const, product: product(1), isAssigned: false },
      { marketplace: "tcgplayer" as const, product: product(2), isAssigned: false },
      { marketplace: "tcgplayer" as const, product: product(3), isAssigned: true },
      { marketplace: "cardmarket" as const, product: product(4), isAssigned: false },
    ];
    const suggestions = new Map([
      ["tcgplayer:1", [{ printingId: "p1", score: 120 }]],
      ["tcgplayer:2", [{ printingId: "p1", score: 180 }]],
      ["tcgplayer:3", [{ printingId: "p1", score: 200 }]],
      ["cardmarket:4", [{ printingId: "p2", score: 200 }]],
    ]);

    const result = listingSuggestionsForPrinting(entries, suggestions, keyOf, "p1");

    expect(result.map((entry) => entry.product.externalId)).toEqual([2, 1]);
  });
});

describe("printingCompareGroups", () => {
  it("lists this printing's checked and open candidates and leaves others out", () => {
    const source = makeCandidateCard({ provider: "provider-a" });
    const open = makeCandidatePrinting({ candidateCardId: source.id, printingId: "p1" });
    const checked = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "p1",
      checkedAt: "2026-10-20T10:00:00.000Z",
    });
    const other = makeCandidatePrinting({ candidateCardId: source.id, printingId: "p2" });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [makeAdminPrinting({ id: "p1" }), makeAdminPrinting({ id: "p2" })],
      candidatePrintings: [open, checked, other],
    });

    const groups = printingCompareGroups([detail], "p1");

    expect(groups).toHaveLength(1);
    expect(groups[0]?.candidates.map((row) => row.id)).toEqual([open.id, checked.id]);
  });

  it("drops candidates from hidden providers", () => {
    const shown = makeCandidateCard({ provider: "provider-a" });
    const hidden = makeCandidateCard({ provider: "provider-b" });
    const detail = makeAdminCardDetail({
      sources: [shown, hidden],
      printings: [makeAdminPrinting({ id: "p1" })],
      candidatePrintings: [
        makeCandidatePrinting({ candidateCardId: shown.id, printingId: "p1" }),
        makeCandidatePrinting({ candidateCardId: hidden.id, printingId: "p1" }),
      ],
    });

    const groups = printingCompareGroups([detail], "p1", new Set(["provider-b"]));

    expect(groups[0]?.candidates.map((row) => row.candidateCardId)).toEqual([shown.id]);
  });

  it("splits a double-faced printing into one group per face, front first", () => {
    const front = makeAdminPrinting({ id: "p1", faceId: "f1", side: 1, shortCode: "OGN-001" });
    const back = makeAdminPrinting({ id: "p1", faceId: "f2", side: 2, shortCode: "OGN-001b" });
    const source = makeCandidateCard({ provider: "provider-a" });
    const frontRow = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "p1",
      shortCode: "OGN-001",
    });
    const backRow = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "p1",
      shortCode: "OGN-001b",
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [back, front],
      candidatePrintings: [frontRow, backRow],
    });

    const groups = printingCompareGroups([detail, detail], "p1");

    expect(groups.map((group) => group.face.faceId)).toEqual(["f1", "f2"]);
    expect(groups.map((group) => group.candidates.map((row) => row.id))).toEqual([
      [frontRow.id],
      [backRow.id],
    ]);
  });

  it("returns nothing when no detail carries the printing", () => {
    expect(printingCompareGroups([makeAdminCardDetail()], "p1")).toEqual([]);
  });
});
