import type { WorkspaceQueueItem } from "@openrift/shared/contracts/admin/catalog-workspace";
import { describe, expect, it, vi } from "vitest";

import type { UploadSourceRow } from "./use-workspace-uploads";

vi.mock("@/lib/server-fns/orpc-client", () => ({ apiOrpcClient: vi.fn() }));

const {
  providerQueueLink,
  repeatedDifferenceInput,
  splitUploadSources,
  uploadChangeSummary,
  uploadOpenSummary,
  uploadSourceRows,
} = await import("./use-workspace-uploads");

function source(overrides: Partial<UploadSourceRow>): UploadSourceRow {
  return {
    provider: "provider-a",
    label: "Provider A",
    uploadedAt: "2026-10-20T08:00:00.000Z",
    newCards: 0,
    newPrintings: 0,
    updates: 0,
    removed: 0,
    open: 0,
    new: 0,
    oldestOpenAt: null,
    repeatedDifference: null,
    ...overrides,
  };
}

function item(overrides: Partial<WorkspaceQueueItem>): WorkspaceQueueItem {
  return {
    id: crypto.randomUUID(),
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

describe("uploadSourceRows", () => {
  const { open: _open, new: _new, oldestOpenAt: _oldest, ...upload } = source({});

  it("counts each source's open and new items with the oldest one", () => {
    const { sources } = uploadSourceRows(
      [upload],
      [
        item({ createdAt: "2026-10-20T09:00:00.000Z" }),
        item({ segment: "new", createdAt: "2026-10-18T09:00:00.000Z" }),
        item({ provider: "provider-b" }),
      ],
    );
    expect(sources).toEqual([
      { ...upload, open: 1, new: 1, oldestOpenAt: "2026-10-18T09:00:00.000Z" },
    ]);
  });

  it("leaves marketplace listings out of the source counts", () => {
    const { sources } = uploadSourceRows(
      [{ ...upload, provider: "TCGplayer" }],
      [item({ reason: "listing", owner: "printing", provider: "TCGplayer" })],
    );
    expect(sources[0]).toMatchObject({ open: 0, new: 0, oldestOpenAt: null });
  });

  it("counts contributor items with the oldest as since", () => {
    const { contributors } = uploadSourceRows(
      [],
      [
        item({ isContributor: true, provider: null, createdAt: "2026-10-20T09:00:00.000Z" }),
        item({ isContributor: true, createdAt: "2026-10-18T09:00:00.000Z" }),
        item({}),
      ],
    );
    expect(contributors).toEqual({ since: "2026-10-18T09:00:00.000Z", count: 2 });
  });

  it("reports no contributors as a null since", () => {
    expect(uploadSourceRows([], []).contributors).toEqual({ since: null, count: 0 });
  });
});

describe("splitUploadSources", () => {
  it("sorts by open count, then new count, then newest upload", () => {
    const { active } = splitUploadSources([
      source({ provider: "a", open: 2 }),
      source({ provider: "b", open: 9 }),
      source({ provider: "c", open: 2, new: 3 }),
      source({ provider: "d", open: 2, uploadedAt: "2026-10-25T08:00:00.000Z" }),
    ]);
    expect(active.map((row) => row.provider)).toEqual(["b", "c", "d", "a"]);
  });

  it("moves sources with nothing open or new into the quiet list", () => {
    const { active, quiet } = splitUploadSources([
      source({ provider: "a", updates: 4 }),
      source({ provider: "b", new: 1 }),
    ]);
    expect(active.map((row) => row.provider)).toEqual(["b"]);
    expect(quiet.map((row) => row.provider)).toEqual(["a"]);
  });

  it("returns two empty lists for no sources", () => {
    expect(splitUploadSources([])).toEqual({ active: [], quiet: [] });
  });
});

describe("uploadChangeSummary", () => {
  it("lists only the non-zero counts", () => {
    expect(uploadChangeSummary(source({ newCards: 1, newPrintings: 3, removed: 2 }))).toBe(
      "1 new card, 3 new printings, 2 removed",
    );
    expect(uploadChangeSummary(source({ updates: 1 }))).toBe("1 update");
  });

  it("says so when the upload changed nothing", () => {
    expect(uploadChangeSummary(source({}))).toBe("No changes");
  });
});

describe("uploadOpenSummary", () => {
  it("joins open and new counts", () => {
    expect(uploadOpenSummary(source({ open: 4, new: 2 }))).toBe("4 open, 2 new");
    expect(uploadOpenSummary(source({ new: 2 }))).toBe("2 new");
    expect(uploadOpenSummary(source({}))).toBe("Nothing open");
  });
});

describe("providerQueueLink", () => {
  it("picks the owner with the most items from that provider", () => {
    const items = [
      item({ owner: "card" }),
      item({ owner: "printing", segment: "new" }),
      item({ owner: "printing", segment: "new" }),
      item({ owner: "face", provider: "provider-b" }),
      item({ owner: "face", provider: "provider-b" }),
      item({ owner: "face", provider: "provider-b" }),
    ];
    expect(providerQueueLink(items, "provider-a")).toEqual({ owner: "printing", segment: "new" });
  });

  it("prefers the open segment when the owner has open items", () => {
    const items = [item({ owner: "printing" }), item({ owner: "printing", segment: "new" })];
    expect(providerQueueLink(items, "provider-a")).toEqual({
      owner: "printing",
      segment: "open",
    });
  });

  it("falls back to the open cards queue", () => {
    expect(providerQueueLink([], "provider-a")).toEqual({ owner: "card", segment: "open" });
  });
});

describe("repeatedDifferenceInput", () => {
  it("builds the same-difference input for a repeated card field", () => {
    expect(
      repeatedDifferenceInput(
        source({ repeatedDifference: { field: "name", value: "Jinx", count: 9 } }),
      ),
    ).toEqual({ provider: "provider-a", field: "name", value: "Jinx" });
  });

  it("skips a single difference, an unknown field and a missing group", () => {
    expect(
      repeatedDifferenceInput(
        source({ repeatedDifference: { field: "name", value: "Jinx", count: 1 } }),
      ),
    ).toBeNull();
    expect(
      repeatedDifferenceInput(
        source({ repeatedDifference: { field: "nope", value: "x", count: 4 } }),
      ),
    ).toBeNull();
    expect(repeatedDifferenceInput(source({}))).toBeNull();
  });
});
