import { describe, expect, it } from "vitest";

import {
  batchOutcomeText,
  batchPreviewQueryKey,
  suggestedListingsPreview,
  listingsBatchLabel,
  toBatchOutcome,
} from "./use-workspace-batch";

describe("batch previews", () => {
  it("keys suggested listings by listing", () => {
    expect(
      suggestedListingsPreview({
        count: 1,
        items: [
          { listingKey: "l1", printingId: "p1", label: "Gold Token Foil", strength: "strong" },
        ],
      }),
    ).toEqual({ count: 1, names: ["Gold Token Foil"], keys: ["l1"], ineligible: [] });
  });

  it("caches previews under the workspace prefix", () => {
    expect(batchPreviewQueryKey("trusted-cards").slice(0, 2)).toEqual(["admin", "workspace"]);
  });
});

describe("batch outcomes", () => {
  it("reads accepted cards with their skipped names", () => {
    const outcome = toBatchOutcome({
      accepted: 2,
      skipped: [{ name: "Viktor, Herald", reason: "Might is missing" }],
    });
    expect(outcome).toEqual({
      done: 2,
      skipped: [{ key: "0:Viktor, Herald", label: "Viktor, Herald", reason: "Might is missing" }],
    });
    expect(batchOutcomeText("trusted-cards", outcome)).toBe("Accepted 2 cards. 1 skipped.");
  });

  it("reads accepted printings with their skipped labels", () => {
    const outcome = toBatchOutcome({
      accepted: 1,
      skipped: [{ label: "OGN-066p FR", reason: "Duplicate" }],
    });
    expect(outcome.skipped).toEqual([
      { key: "0:OGN-066p FR", label: "OGN-066p FR", reason: "Duplicate" },
    ]);
    expect(batchOutcomeText("trusted-printings", outcome)).toBe("Accepted 1 printing. 1 skipped.");
  });

  it("reads assigned listings", () => {
    const outcome = toBatchOutcome({ assigned: 4, skipped: [] });
    expect(outcome).toEqual({ done: 4, skipped: [] });
    expect(batchOutcomeText("suggested-listings", outcome)).toBe("Assigned 4 listings.");
  });

  it("reads listings that failed to assign", () => {
    const outcome = toBatchOutcome({
      assigned: 1,
      skipped: [{ label: "Poro Herder OGN-027", reason: "no marketplace product found" }],
    });
    expect(outcome.skipped).toEqual([
      {
        key: "0:Poro Herder OGN-027",
        label: "Poro Herder OGN-027",
        reason: "no marketplace product found",
      },
    ]);
    expect(batchOutcomeText("suggested-listings", outcome)).toBe("Assigned 1 listing. 1 skipped.");
  });
});

describe("listingsBatchLabel", () => {
  it("counts the listings the batch assigns", () => {
    expect(listingsBatchLabel(1)).toBe("Assign 1 listing by suggestion");
    expect(listingsBatchLabel(4)).toBe("Assign 4 listings by suggestion");
  });
});
