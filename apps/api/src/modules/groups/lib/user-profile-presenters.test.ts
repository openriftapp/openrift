import { describe, expect, it } from "vitest";

import type { BundleListSummary } from "../repositories/user-shares.js";
import { lastActiveBucket, toBundleList } from "./user-profile-presenters.js";

describe("toBundleList", () => {
  const row = {
    list: {
      id: "l1",
      name: "Binder",
      intent: "trade",
      kind: "copy",
      isPublic: false,
      shareToken: "revokedTok123",
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      updatedAt: new Date("2026-03-02T10:00:00.000Z"),
      rules: null,
    },
    entryCount: 4,
    viaGroups: [],
  } as unknown as BundleListSummary;

  it("reads isPublic from the row, so a revoked token is not public", () => {
    expect(toBundleList(row, undefined, null).isPublic).toBe(false);
  });

  it("prefers the expanded count and previews", () => {
    expect(toBundleList(row, { entryCount: 9, previewImageIds: ["i1"] }, 2)).toMatchObject({
      entryCount: 9,
      previewImageIds: ["i1"],
      matchCount: 2,
      createdAt: "2026-03-01T10:00:00.000Z",
      hasRule: false,
    });
  });

  it("falls back to the materialized count without an expansion", () => {
    expect(toBundleList(row, undefined, null)).toMatchObject({
      entryCount: 4,
      previewImageIds: [],
      matchCount: null,
    });
  });
});

const NOW = new Date("2026-09-11T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000);

describe("lastActiveBucket", () => {
  it("returns null without any session", () => {
    expect(lastActiveBucket(null, NOW)).toBeNull();
  });

  it("buckets by age with the boundary falling into the older bucket", () => {
    expect(lastActiveBucket(hoursAgo(0), NOW)).toBe("today");
    expect(lastActiveBucket(hoursAgo(23), NOW)).toBe("today");
    expect(lastActiveBucket(hoursAgo(24), NOW)).toBe("week");
    expect(lastActiveBucket(hoursAgo(24 * 7 - 1), NOW)).toBe("week");
    expect(lastActiveBucket(hoursAgo(24 * 7), NOW)).toBe("month");
    expect(lastActiveBucket(hoursAgo(24 * 30 - 1), NOW)).toBe("month");
    expect(lastActiveBucket(hoursAgo(24 * 30), NOW)).toBe("older");
    expect(lastActiveBucket(hoursAgo(24 * 400), NOW)).toBe("older");
  });
});
