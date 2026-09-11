import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { describe, expect, it } from "vitest";

import { cardAttentionBadges, hasIssue, needsAttention } from "./card-attention";

function makeRow(overrides: Partial<CandidateCardSummaryResponse> = {}) {
  return {
    cardSlug: "fireball",
    name: "Fireball",
    normalizedName: "fireball",
    shortCodes: [],
    stagingShortCodes: [],
    setSlugs: [],
    candidateCount: 0,
    uncheckedCardCount: 0,
    uncheckedPrintingCount: 0,
    unlinkedPrintingCount: 0,
    unlinkedTrustedPrintingCount: 0,
    hasFavorite: false,
    favoriteStagingShortCodes: [],
    suggestedCardSlug: null,
    hasUserSubmission: false,
    pendingSubmissions: 0,
    uncheckedTrustedProviders: [],
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  } as CandidateCardSummaryResponse;
}

describe("cardAttentionBadges", () => {
  it("says nothing about a quiet card", () => {
    expect(cardAttentionBadges(makeRow())).toEqual([]);
  });

  it("names each kind of attention it finds", () => {
    const badges = cardAttentionBadges(
      makeRow({
        pendingSubmissions: 2,
        unlinkedTrustedPrintingCount: 1,
        uncheckedTrustedProviders: ["gallery", "usersubmission"],
      }),
      4,
    );

    expect(badges.map((badge) => badge.key)).toEqual([
      "proposals",
      "new-printings",
      "unchecked-source",
      "unlinked-products",
    ]);
    expect(badges.map((badge) => badge.label)).toEqual([
      "2 submissions",
      "1 new trusted printing",
      "unchecked: gallery, usersubmission",
      "marketplace: 4 unlinked",
    ]);
  });

  it("keeps the untrusted proposals in the tooltip", () => {
    const badges = cardAttentionBadges(
      makeRow({ unlinkedTrustedPrintingCount: 1, unlinkedPrintingCount: 4 }),
    );
    expect(badges.at(0)?.label).toBe("1 new trusted printing");
    expect(badges.at(0)?.title).toBe("3 more proposed by sources you do not trust");
  });

  it("says which side the unlinked count is about", () => {
    const badges = cardAttentionBadges(makeRow(), 1);
    expect(badges.at(0)?.label).toBe("marketplace: 1 unlinked");
  });
});

describe("needsAttention", () => {
  it("is quiet about a settled card", () => {
    expect(needsAttention(makeRow(), 0)).toBe(false);
  });

  it("catches a card with any one issue", () => {
    expect(needsAttention(makeRow({ pendingSubmissions: 1 }), 0)).toBe(true);
    expect(needsAttention(makeRow(), 3)).toBe(true);
  });
});

describe("hasIssue", () => {
  it("matches a submission still waiting on an answer", () => {
    expect(hasIssue(makeRow({ pendingSubmissions: 1 }), "proposals", 0)).toBe(true);
    expect(hasIssue(makeRow({ hasUserSubmission: true }), "proposals", 0)).toBe(false);
  });

  it("matches a printing proposed by a trusted source", () => {
    expect(hasIssue(makeRow({ unlinkedTrustedPrintingCount: 1 }), "new-printings", 0)).toBe(true);
    expect(hasIssue(makeRow({ unlinkedPrintingCount: 4 }), "new-printings", 0)).toBe(false);
  });

  it("matches unlinked marketplace entries only through the scoped count", () => {
    expect(hasIssue(makeRow(), "unlinked-products", 2)).toBe(true);
    expect(hasIssue(makeRow(), "unlinked-products", 0)).toBe(false);
  });

  it("matches an unchecked trusted source", () => {
    expect(
      hasIssue(makeRow({ uncheckedTrustedProviders: ["gallery"] }), "unchecked-source", 0),
    ).toBe(true);
    expect(hasIssue(makeRow(), "unchecked-source", 0)).toBe(false);
  });
});
