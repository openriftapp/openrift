import { describe, expect, it } from "vitest";

import type { OverlaySnapshot } from "./overlay-snapshot";
import {
  entriesLabel,
  listNames,
  relativeAge,
  snapshotSummary,
  syncStatus,
} from "./overlay-status";

const NOW = new Date("2026-09-09T12:00:00.000Z");

function list(index: number, name: string, entryCount?: number) {
  return {
    id: `0199a0f2-0000-7000-8000-00000000000${index}`,
    name,
    ...(entryCount === undefined ? {} : { entryCount }),
  };
}

function snapshot(overrides: Partial<OverlaySnapshot> = {}): OverlaySnapshot {
  return {
    lists: [list(1, "Summoner Skirmish wants", 24)],
    marketplace: "cardmarket",
    generatedAt: "2026-09-09T11:00:00.000Z",
    capturedAt: "2026-09-09T11:00:00.000Z",
    products: {
      "1": { owned: 2, wanted: 1, priceCents: null },
      "2": { owned: 0, wanted: 3, priceCents: null },
    },
    ...overrides,
  };
}

describe("relativeAge", () => {
  it("reads anything under a minute as just now", () => {
    expect(relativeAge("2026-09-09T11:59:30.000Z", NOW)).toBe("just now");
  });

  it("singularises one minute and one hour", () => {
    expect(relativeAge("2026-09-09T11:59:00.000Z", NOW)).toBe("1 minute ago");
    expect(relativeAge("2026-09-09T11:00:00.000Z", NOW)).toBe("1 hour ago");
  });

  it("counts whole days past 24 hours", () => {
    expect(relativeAge("2026-09-06T09:00:00.000Z", NOW)).toBe("3 days ago");
  });

  it("treats an unparseable timestamp as just now", () => {
    expect(relativeAge("not a date", NOW)).toBe("just now");
  });
});

describe("listNames", () => {
  it("names up to three lists in full", () => {
    expect(listNames(["Wants"])).toBe("Wants");
    expect(listNames(["Wants", "Playset", "Foils"])).toBe("Wants, Playset, Foils");
  });

  it("counts the rest past three", () => {
    expect(listNames(["Wants", "Playset", "Foils", "Runes", "Promos"])).toBe(
      "Wants, Playset, Foils and 2 more",
    );
  });
});

describe("entriesLabel", () => {
  it("groups the digits and singularises one entry", () => {
    expect(entriesLabel(1204)).toBe("1,204 entries");
    expect(entriesLabel(1)).toBe("1 entry");
    expect(entriesLabel(0)).toBe("0 entries");
  });

  it("says nothing for a snapshot taken before the count was sent", () => {
    expect(entriesLabel(undefined)).toBeUndefined();
  });
});

describe("syncStatus", () => {
  it("has nothing to show before the first synchronize", () => {
    const status = syncStatus(undefined, NOW);
    expect(status.lists).toEqual([]);
    expect(status.lastSync).toBeUndefined();
    expect(status.stale).toBe(true);
  });

  it("names the lists and dates the capture", () => {
    const status = syncStatus(snapshot(), NOW);
    expect(status.lists).toEqual([list(1, "Summoner Skirmish wants", 24)]);
    expect(status.more).toBe(0);
    expect(status.lastSync).toBe("1 hour ago");
    expect(status.stale).toBe(false);
  });

  it("counts the lists past the fourth instead of naming them", () => {
    const status = syncStatus(
      snapshot({
        lists: [1, 2, 3, 4, 5, 6].map((index) => list(index, `List ${index}`, index)),
      }),
      NOW,
    );
    expect(status.lists.map((entry) => entry.name)).toEqual([
      "List 1",
      "List 2",
      "List 3",
      "List 4",
    ]);
    expect(status.more).toBe(2);
  });

  it("marks a capture older than two days as stale", () => {
    const status = syncStatus(snapshot({ capturedAt: "2026-09-06T12:00:00.000Z" }), NOW);
    expect(status.stale).toBe(true);
    expect(status.lastSync).toBe("3 days ago");
  });
});

describe("snapshotSummary", () => {
  it("says nothing is synchronized when nothing is stored", () => {
    expect(snapshotSummary(undefined, NOW)).toBe("No lists synchronized yet.");
  });

  it("names the lists and the age in one sentence", () => {
    const two = snapshot({ lists: [list(1, "Wants", 4), list(2, "Playset", 900)] });
    expect(snapshotSummary(two, NOW)).toBe("Wants, Playset, synchronized 1 hour ago.");
  });
});
