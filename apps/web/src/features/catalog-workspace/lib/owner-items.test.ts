import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { describe, expect, it } from "vitest";

import {
  cardPendingBadges,
  cardSummaryKey,
  cardSummaryTarget,
  filterCardSummaries,
  ownersForRole,
  recordEntry,
  workspaceRole,
} from "./owner-items";

function summary(overrides: Partial<CandidateCardSummaryResponse>): CandidateCardSummaryResponse {
  return {
    cardSlug: "jinx-loose-cannon",
    name: "Jinx, Loose Cannon",
    normalizedName: "jinx loose cannon",
    shortCodes: ["OGN-030"],
    stagingShortCodes: [],
    setSlugs: ["origins"],
    candidateCount: 1,
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
    updatedAt: "2026-10-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("workspaceRole", () => {
  it("ranks admin over grants and card-review over the desk", () => {
    expect(workspaceRole({ isAdmin: true, sections: [] })).toBe("admin");
    expect(workspaceRole({ isAdmin: false, sections: ["printing-desk", "card-review"] })).toBe(
      "reviewer",
    );
    expect(workspaceRole({ isAdmin: false, sections: ["printing-desk"] })).toBe("desk");
    expect(workspaceRole({ isAdmin: false, sections: ["products"] })).toBe("none");
    expect(workspaceRole(undefined)).toBe("none");
  });

  it("limits desk holders to printings", () => {
    expect(ownersForRole("desk")).toEqual(["printing"]);
    expect(ownersForRole("reviewer")).toEqual(["card", "face", "printing"]);
    expect(ownersForRole("none")).toEqual([]);
  });
});

describe("cardPendingBadges", () => {
  it("counts the unchecked source rows and the proposals", () => {
    expect(
      cardPendingBadges(
        summary({ uncheckedCardCount: 1, uncheckedPrintingCount: 2, pendingSubmissions: 1 }),
      ),
    ).toEqual([
      { label: "3 from sources", variant: "warning" },
      { label: "1 proposal", variant: "violet" },
    ]);
  });

  it("shows sources and trust on a draft", () => {
    const draft = summary({
      cardSlug: null,
      candidateCount: 3,
      uncheckedTrustedProviders: ["provider-a"],
    });
    expect(cardPendingBadges(draft).map((badge) => badge.label)).toEqual(["3 sources", "Trusted"]);
  });

  it("shows nothing for a settled card", () => {
    expect(cardPendingBadges(summary({}))).toEqual([]);
  });
});

describe("record and card entries", () => {
  it("links face rows to the face record", () => {
    const entry = recordEntry("face", {
      id: "f1",
      cardSlug: "jinx",
      cardName: "Jinx",
      setName: "Origins",
      shortCode: "OGN-030",
      language: "en",
      finish: "foil",
      imageUrl: null,
      updatedAt: "2026-10-20T10:00:00.000Z",
    });
    expect(entry.key).toBe("face:f1");
    expect(entry.target).toEqual({ kind: "face", cardSlug: "jinx", faceId: "f1" });
  });

  it("links drafts to the new-card record by normalized name", () => {
    expect(cardSummaryTarget(summary({ cardSlug: null }))).toEqual({
      kind: "card-new",
      name: "jinx loose cannon",
    });
  });

  it("has no target for a draft without a name", () => {
    expect(cardSummaryTarget(summary({ cardSlug: null, normalizedName: "" }))).toBeNull();
  });

  it("keys card rows by their record, and a draft without a name by its row name", () => {
    expect(cardSummaryKey(summary({}))).toBe("card:jinx-loose-cannon");
    expect(cardSummaryKey(summary({ cardSlug: null }))).toBe("card-new:jinx loose cannon");
    expect(cardSummaryKey(summary({ cardSlug: null, normalizedName: "" }))).toBe(
      "card-row:Jinx, Loose Cannon",
    );
  });

  it("filters card summaries by name or code and sorts them by name", () => {
    const rows = [
      summary({ name: "Yasuo", cardSlug: "yasuo", shortCodes: ["OGN-200"] }),
      summary({ name: "Ahri", cardSlug: "ahri", shortCodes: ["OGN-066"] }),
    ];
    expect(filterCardSummaries(rows, undefined).map((row) => row.name)).toEqual(["Ahri", "Yasuo"]);
    expect(filterCardSummaries(rows, "OGN-200").map((row) => row.name)).toEqual(["Yasuo"]);
  });
});
