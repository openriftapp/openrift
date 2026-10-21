import type { WorkspaceQueueItem } from "@openrift/shared/contracts/admin/catalog-workspace";
import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { describe, expect, it } from "vitest";

import {
  cardSummaryEntry,
  compactAge,
  filterCardSummaries,
  filterGroups,
  groupDetail,
  groupEntry,
  groupOwnerItems,
  itemTarget,
  nextQueue,
  oldestItem,
  ownersForRole,
  queueStats,
  recordEntry,
  segmentCounts,
  selectedKeyFromParams,
  sortGroups,
  stepIndex,
  targetKey,
  visibleQueueItems,
  workspaceRole,
} from "./owner-items";
import { workspaceQueueFixture } from "./workspace-queue.fixture";

const ITEMS = workspaceQueueFixture.items;

function item(overrides: Partial<WorkspaceQueueItem>): WorkspaceQueueItem {
  return {
    id: "card:x",
    owner: "card",
    segment: "open",
    ownerId: "jinx-loose-cannon",
    cardSlug: "jinx-loose-cannon",
    cardName: "Jinx, Loose Cannon",
    label: "Jinx, Loose Cannon",
    reason: "source-difference",
    provider: "provider-a",
    isContributor: false,
    decisions: 1,
    fields: [],
    createdAt: "2026-10-18T09:12:00.000Z",
    ...overrides,
  };
}

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

describe("visibleQueueItems", () => {
  it("drops cards and faces for desk holders", () => {
    const visible = visibleQueueItems(ITEMS, "desk");
    expect(visible.every((entry) => entry.owner === "printing")).toBe(true);
    expect(visible).toHaveLength(2);
  });
});

describe("itemTarget", () => {
  it("routes each owner and segment to its record", () => {
    const [open, , draft, face, , printing, candidate] = ITEMS;
    expect(itemTarget(open!)).toEqual({ kind: "card", cardSlug: "jinx-loose-cannon" });
    expect(itemTarget(draft!)).toEqual({ kind: "card-new", name: "ahri nine tailed fox" });
    expect(itemTarget(face!)).toEqual({
      kind: "face",
      cardSlug: "jinx-loose-cannon",
      faceId: "0190a000-0000-7000-8000-0000000000f1",
    });
    expect(itemTarget(printing!)).toEqual({
      kind: "printing",
      printingId: "0190a000-0000-7000-8000-0000000000a1",
    });
    expect(itemTarget(candidate!)).toEqual({
      kind: "printing-new",
      candidatePrintingId: "0190a000-0000-7000-8000-0000000000b1",
    });
  });

  it("has no target for a face without a card", () => {
    expect(itemTarget(item({ owner: "face", cardSlug: null }))).toBeNull();
  });
});

describe("selectedKeyFromParams", () => {
  it("matches the key of the target the params came from", () => {
    expect(selectedKeyFromParams({ cardSlug: "jinx" })).toBe(
      targetKey({ kind: "card", cardSlug: "jinx" }),
    );
    expect(selectedKeyFromParams({ name: "ahri" })).toBe(
      targetKey({ kind: "card-new", name: "ahri" }),
    );
    expect(selectedKeyFromParams({ cardSlug: "jinx", faceId: "f1" })).toBe(
      targetKey({ kind: "face", cardSlug: "jinx", faceId: "f1" }),
    );
    expect(selectedKeyFromParams({ printingId: "p1" })).toBe(
      targetKey({ kind: "printing", printingId: "p1" }),
    );
    expect(selectedKeyFromParams({ candidatePrintingId: "c1" })).toBe(
      targetKey({ kind: "printing-new", candidatePrintingId: "c1" }),
    );
    expect(selectedKeyFromParams({})).toBeNull();
  });
});

describe("groupOwnerItems", () => {
  it("shows a card once with its decisions summed", () => {
    const groups = groupOwnerItems([
      item({ id: "a", decisions: 2, createdAt: "2026-10-18T09:00:00.000Z" }),
      item({
        id: "b",
        reason: "contributor-proposal",
        provider: "contributors",
        isContributor: true,
        decisions: 1,
        createdAt: "2026-10-16T09:00:00.000Z",
      }),
      item({ id: "c", provider: "provider-b", createdAt: "2026-10-19T09:00:00.000Z" }),
    ]);
    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group?.decisions).toBe(4);
    expect(group?.reasons).toEqual(["source-difference", "contributor-proposal"]);
    expect(group?.providers).toEqual(["provider-a", "provider-b"]);
    expect(group?.isContributor).toBe(true);
    expect(group?.oldestAt).toBe("2026-10-16T09:00:00.000Z");
    expect(group?.newestAt).toBe("2026-10-19T09:00:00.000Z");
  });

  it("keeps the same owner id apart across segments", () => {
    const groups = groupOwnerItems([
      item({ ownerId: "x", segment: "open" }),
      item({ ownerId: "x", segment: "new" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("counts groups per segment", () => {
    const cards = groupOwnerItems(ITEMS.filter((entry) => entry.owner === "card"));
    expect(segmentCounts(cards)).toEqual({ open: 2, new: 1 });
  });
});

describe("filterGroups", () => {
  const groups = groupOwnerItems(ITEMS.filter((entry) => entry.owner === "card"));

  it("filters by source, reason and name", () => {
    expect(filterGroups(groups, { provider: "provider-b" }).map((g) => g.ownerId)).toEqual([
      "ahri nine tailed fox",
    ]);
    expect(filterGroups(groups, { reason: "contributor-proposal" }).map((g) => g.ownerId)).toEqual([
      "yasuo-unforgiven",
    ]);
    expect(filterGroups(groups, { q: "jinx" }).map((g) => g.ownerId)).toEqual([
      "jinx-loose-cannon",
    ]);
  });

  it("keeps everything without filters", () => {
    expect(filterGroups(groups, { q: "  " })).toHaveLength(3);
  });
});

describe("sortGroups", () => {
  const groups = groupOwnerItems(ITEMS.filter((entry) => entry.owner === "card"));

  it("sorts oldest first, newest first or by card name", () => {
    expect(sortGroups(groups, "oldest").map((g) => g.cardName)).toEqual([
      "Jinx, Loose Cannon",
      "Yasuo, Unforgiven",
      "Ahri, Nine-Tailed Fox",
    ]);
    expect(sortGroups(groups, "newest").map((g) => g.cardName)).toEqual([
      "Ahri, Nine-Tailed Fox",
      "Yasuo, Unforgiven",
      "Jinx, Loose Cannon",
    ]);
    expect(sortGroups(groups, "card").map((g) => g.cardName)).toEqual([
      "Ahri, Nine-Tailed Fox",
      "Jinx, Loose Cannon",
      "Yasuo, Unforgiven",
    ]);
  });

  it("moves skipped records to the end in skip order", () => {
    const sorted = sortGroups(groups, "oldest", [
      "card:jinx-loose-cannon",
      "card:yasuo-unforgiven",
    ]);
    expect(sorted.map((g) => g.key)).toEqual([
      "card-new:ahri nine tailed fox",
      "card:jinx-loose-cannon",
      "card:yasuo-unforgiven",
    ]);
  });
});

describe("groupDetail and groupEntry", () => {
  it("names the reasons and the sources", () => {
    const [group] = groupOwnerItems([
      item({}),
      item({ id: "b", reason: "new-image", provider: null }),
    ]);
    expect(groupDetail(group!)).toBe("Source differences · New image · provider-a");
  });

  it("shows the face label as the code and keeps the card name as the title", () => {
    const [group] = groupOwnerItems(ITEMS.filter((entry) => entry.owner === "face").slice(0, 1));
    const entry = groupEntry(group!);
    expect(entry.title).toBe("Jinx, Loose Cannon");
    expect(entry.code).toBe("OGN-030 front");
    expect(entry.decisions).toBe(3);
  });

  it("shows no code for cards", () => {
    const [group] = groupOwnerItems([item({})]);
    expect(groupEntry(group!).code).toBeUndefined();
  });
});

describe("queueStats", () => {
  it("sums decisions and finds the oldest record", () => {
    const groups = groupOwnerItems(ITEMS.filter((entry) => entry.owner === "face"));
    expect(queueStats(groups)).toEqual({ decisions: 4, oldestAt: "2026-10-17T11:45:00.000Z" });
  });

  it("reports nothing for an empty queue", () => {
    expect(queueStats([])).toEqual({ decisions: 0, oldestAt: null });
  });
});

describe("nextQueue", () => {
  it("picks the next owner that has work, wrapping around", () => {
    expect(nextQueue(ITEMS, "face", "admin")).toEqual({
      owner: "printing",
      count: 2,
      segment: "open",
    });
    expect(nextQueue(ITEMS, "printing", "admin")?.owner).toBe("card");
  });

  it("returns null when no other queue has work", () => {
    const onlyCards = ITEMS.filter((entry) => entry.owner === "card");
    expect(nextQueue(onlyCards, "card", "admin")).toBeNull();
    expect(nextQueue(ITEMS, "printing", "desk")).toBeNull();
  });

  it("opens the New segment when only new records are left", () => {
    const onlyNew = [item({ owner: "printing", segment: "new", ownerId: "c1" })];
    expect(nextQueue(onlyNew, "card", "admin")).toEqual({
      owner: "printing",
      count: 1,
      segment: "new",
    });
  });
});

describe("oldestItem", () => {
  it("finds the oldest linkable item the role can see", () => {
    expect(oldestItem(ITEMS, "admin")?.id).toBe(
      "printing:source-difference:0190a000-0000-7000-8000-0000000000a1:provider-b",
    );
    expect(oldestItem([], "admin")).toBeNull();
  });

  it("skips items without a record", () => {
    const orphan = item({ owner: "face", cardSlug: null, createdAt: "2020-01-01T00:00:00.000Z" });
    expect(oldestItem([orphan], "admin")).toBeNull();
  });
});

describe("stepIndex", () => {
  it("moves forward and back inside the list", () => {
    expect(stepIndex(3, 0, 1)).toBe(1);
    expect(stepIndex(3, 2, -1)).toBe(1);
  });

  it("starts at the top when nothing is selected", () => {
    expect(stepIndex(3, -1, 1)).toBe(0);
    expect(stepIndex(3, -1, -1)).toBeNull();
  });

  it("wraps forward past the end and stops at the top", () => {
    expect(stepIndex(3, 2, 1)).toBe(0);
    expect(stepIndex(3, 0, -1)).toBeNull();
    expect(stepIndex(1, 0, 1)).toBeNull();
    expect(stepIndex(0, -1, 1)).toBeNull();
  });
});

describe("compactAge", () => {
  it("drops the 'ago' suffix", () => {
    const now = new Date("2026-10-21T12:00:00.000Z");
    expect(compactAge("2026-10-16T12:00:00.000Z", now)).toBe("5d");
    expect(compactAge("2026-10-20T16:00:00.000Z", now)).toBe("20h");
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
    expect(entry.detail).toBe("Origins · EN · foil");
    expect(entry.target).toEqual({ kind: "face", cardSlug: "jinx", faceId: "f1" });
  });

  it("links drafts to the new-card record by normalized name", () => {
    const entry = cardSummaryEntry(summary({ cardSlug: null, pendingSubmissions: 2 }));
    expect(entry.target).toEqual({ kind: "card-new", name: "jinx loose cannon" });
    expect(entry.draft).toBe(true);
    expect(entry.decisions).toBe(2);
  });

  it("has no target for a draft without a name", () => {
    expect(cardSummaryEntry(summary({ cardSlug: null, normalizedName: "" })).target).toBeNull();
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
