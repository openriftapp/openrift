import { beforeEach, describe, expect, it } from "vitest";

import {
  resetIdCounter,
  makeCandidateCard,
  makeCandidatePrinting,
  makeProviderSetting,
  makeUnmatchedCardDetail,
} from "@/test/factories";

import {
  buildDraftPrefill,
  buildDraftPrintingRows,
  draftRulesText,
  missingDraftFields,
  sortSourcesByPriority,
  toCreateCardBody,
} from "./draft-prefill";

beforeEach(() => {
  resetIdCounter();
});

const SETTINGS = [
  makeProviderSetting({ provider: "gallery", sortOrder: 0 }),
  makeProviderSetting({ provider: "playloltcg", sortOrder: 5 }),
];

describe("sortSourcesByPriority", () => {
  it("orders by the provider's sort order", () => {
    const sources = [
      makeCandidateCard({ provider: "playloltcg" }),
      makeCandidateCard({ provider: "gallery" }),
    ];
    expect(sortSourcesByPriority(sources, SETTINGS).map((s) => s.provider)).toEqual([
      "gallery",
      "playloltcg",
    ]);
  });
});

describe("buildDraftPrefill", () => {
  it("takes each field from the highest-priority source that has one", () => {
    const detail = makeUnmatchedCardDetail({
      defaultCardId: "OGN-042",
      sources: [
        makeCandidateCard({
          provider: "playloltcg",
          name: "Jinx, Loose Cannon",
          types: ["unit"],
          domains: ["chaos"],
          might: 4,
        }),
        makeCandidateCard({
          provider: "gallery",
          name: "Jinx, the Loose Cannon",
          types: [],
          domains: ["fury"],
          might: null,
        }),
      ],
    });
    const fields = buildDraftPrefill(detail, SETTINGS);
    expect(fields.id).toBe("OGN-042");
    expect(fields.name).toBe("Jinx, the Loose Cannon");
    expect(fields.domains).toEqual(["fury"]);
    expect(fields.types).toEqual(["unit"]);
    expect(fields.might).toBe("4");
  });

  it("leaves fields blank when no source carries one", () => {
    const detail = makeUnmatchedCardDetail({
      sources: [makeCandidateCard({ tags: [], energy: null })],
    });
    const fields = buildDraftPrefill(detail, SETTINGS);
    expect(fields.tags).toEqual([]);
    expect(fields.energy).toBe("");
  });
});

describe("draftRulesText", () => {
  it("reads the highest-priority rules text", () => {
    const detail = makeUnmatchedCardDetail({
      sources: [
        makeCandidateCard({ provider: "playloltcg", rulesText: "Deal 2 damage." }),
        makeCandidateCard({ provider: "gallery", rulesText: "Deal 3 damage." }),
      ],
    });
    expect(draftRulesText(detail, SETTINGS)).toBe("Deal 3 damage.");
  });
});

describe("missingDraftFields", () => {
  it("names the blank required fields", () => {
    const detail = makeUnmatchedCardDetail({
      defaultCardId: "",
      sources: [makeCandidateCard({ name: "", types: [], domains: ["calm"] })],
    });
    expect(missingDraftFields(buildDraftPrefill(detail, SETTINGS))).toEqual([
      "Card ID",
      "Name",
      "Type",
    ]);
  });

  it("is empty once every required field is filled", () => {
    const detail = makeUnmatchedCardDetail({ sources: [makeCandidateCard()] });
    expect(missingDraftFields(buildDraftPrefill(detail, SETTINGS))).toEqual([]);
  });
});

describe("toCreateCardBody", () => {
  it("drops empty optional fields and parses the numbers", () => {
    const detail = makeUnmatchedCardDetail({
      sources: [makeCandidateCard({ tags: [], superTypes: [], energy: null, might: 3 })],
    });
    const body = toCreateCardBody(buildDraftPrefill(detail, SETTINGS)) as Record<string, unknown>;
    expect(body.might).toBe(3);
    expect("energy" in body).toBe(false);
    expect("tags" in body).toBe(false);
    expect("superTypes" in body).toBe(false);
  });
});

describe("buildDraftPrintingRows", () => {
  it("shows one row per group and counts its sources", () => {
    const first = makeCandidatePrinting({ shortCode: "OGN-042" });
    const second = makeCandidatePrinting({ shortCode: "OGN-042" });
    const detail = makeUnmatchedCardDetail({
      candidatePrintings: [first, second],
      candidatePrintingGroups: [
        {
          mostCommonShortCode: "OGN-042",
          shortCodes: [first.id, second.id],
          expectedPrintingId: "OGN-042",
          language: "EN",
          suggestedPrintingId: null,
        },
      ],
    });
    const rows = buildDraftPrintingRows(detail);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.candidate.id).toBe(first.id);
    expect(rows[0]?.sourceCount).toBe(2);
  });

  it("still lists a candidate printing no group claimed", () => {
    const orphan = makeCandidatePrinting({ shortCode: "OGN-099" });
    const detail = makeUnmatchedCardDetail({
      candidatePrintings: [orphan],
      candidatePrintingGroups: [],
    });
    expect(buildDraftPrintingRows(detail).map((row) => row.candidate.id)).toEqual([orphan.id]);
  });
});
