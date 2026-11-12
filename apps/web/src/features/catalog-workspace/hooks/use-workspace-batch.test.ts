import { describe, expect, it } from "vitest";

import {
  batchButtonLabel,
  batchOutcomeText,
  batchPreviewQueryKey,
  suggestedListingsPreview,
  toBatchOutcome,
  trustedCardsPreview,
  trustedPrintingsPreview,
} from "./use-workspace-batch";

describe("batch previews", () => {
  it("keys trusted cards by name and lists the held-back ones with their reason", () => {
    expect(
      trustedCardsPreview({
        count: 2,
        names: ["Bird", "Brush"],
        ineligible: [{ name: "Gold", reason: "no card type" }],
      }),
    ).toEqual({
      count: 2,
      names: ["Bird", "Brush"],
      keys: ["Bird", "Brush"],
      ineligible: [{ key: "Gold", label: "Gold", reason: "no card type" }],
    });
  });

  it("keys trusted printings by candidate printing", () => {
    expect(
      trustedPrintingsPreview({
        count: 1,
        items: [{ candidatePrintingId: "cp1", cardSlug: "ahri", label: "Ahri OGN-066p FR" }],
        ineligible: [
          { candidatePrintingId: "cp2", label: "ahri OGN-067 foil EN", reason: "missing: rarity" },
        ],
      }),
    ).toEqual({
      count: 1,
      names: ["Ahri OGN-066p FR"],
      keys: ["cp1"],
      ineligible: [{ key: "cp2", label: "ahri OGN-067 foil EN", reason: "missing: rarity" }],
    });
  });

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
    const outcome = toBatchOutcome({ assigned: 4 });
    expect(outcome).toEqual({ done: 4, skipped: [] });
    expect(batchOutcomeText("suggested-listings", outcome)).toBe("Assigned 4 listings.");
  });
});

describe("batchButtonLabel", () => {
  it("counts what the batch touches", () => {
    expect(batchButtonLabel("trusted-cards", 1)).toBe("Accept 1 trusted new card");
    expect(batchButtonLabel("trusted-cards", 3)).toBe("Accept 3 trusted new cards");
    expect(batchButtonLabel("trusted-printings", 2)).toBe("Accept 2 trusted printings");
    expect(batchButtonLabel("suggested-listings", 1)).toBe("Assign 1 listing by suggestion");
  });
});
