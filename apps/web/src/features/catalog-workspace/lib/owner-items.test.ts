import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { describe, expect, it } from "vitest";

import {
  cardSummaryKey,
  cardSummaryTarget,
  filterCardSummaries,
  ownersForRole,
  recordEntry,
  sortCardsByCatalogOrder,
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

describe("record and card entries", () => {
  it("links face rows to the face record", () => {
    const entry = recordEntry("face", {
      id: "f1",
      cardSlug: "jinx",
      cardName: "Jinx",
      cardType: "unit",
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

  it("keeps a card that has a printing in the set, even when it is in other sets too", () => {
    const rows = [
      summary({ name: "Yasuo", cardSlug: "yasuo", setSlugs: ["OGN"] }),
      summary({ name: "Ahri", cardSlug: "ahri", setSlugs: ["OGN", "SFD"] }),
      summary({ name: "Vi", cardSlug: "vi", setSlugs: [] }),
    ];
    expect(filterCardSummaries(rows, undefined, "sfd").map((row) => row.name)).toEqual(["Ahri"]);
    expect(filterCardSummaries(rows, "yas", "OGN").map((row) => row.name)).toEqual(["Yasuo"]);
  });
});

describe("sortCardsByCatalogOrder", () => {
  const order = { languages: ["EN", "SC"], sets: ["FND", "OGS", "OGN", "SFD"] };
  const card = (name: string, shortCodes: string[]) =>
    summary({ name, cardSlug: name.toLowerCase(), shortCodes });
  const names = (rows: CandidateCardSummaryResponse[]) =>
    sortCardsByCatalogOrder(rows, order).map((row) => row.name);

  it("orders cards by set, then by code within the set", () => {
    expect(
      names([
        card("Zed", ["OGN-010"]),
        card("Ahri", ["SFD-002"]),
        card("Yasuo", ["OGN-2"]),
        card("Annie", ["OGS-001"]),
      ]),
    ).toEqual(["Annie", "Yasuo", "Zed", "Ahri"]);
  });

  it("puts the first language ahead of the set order, like the printing order", () => {
    expect(names([card("Teemo", ["FND-196 [SC]"]), card("Annie", ["OGS-001"])])).toEqual([
      "Annie",
      "Teemo",
    ]);
  });

  it("places a card at its earliest printing", () => {
    expect(names([card("Vi", ["FND-001 [SC]", "OGN-200"]), card("Jinx", ["OGN-150"])])).toEqual([
      "Jinx",
      "Vi",
    ]);
  });

  it("puts cards without a printing in a known set last, by name", () => {
    expect(
      names([card("Teemo", []), card("Lulu", ["XYZ-001"]), card("Annie", ["OGS-001"])]),
    ).toEqual(["Annie", "Lulu", "Teemo"]);
  });
});
