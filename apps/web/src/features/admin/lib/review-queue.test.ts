import { beforeEach, describe, expect, it } from "vitest";

import { resetIdCounter, makeReviewQueueItem } from "@/test/factories";

import {
  countReviewKinds,
  matchesReviewFilter,
  reviewItemTarget,
  selectReviewItems,
  summarizeReviewItem,
} from "./review-queue";

beforeEach(() => {
  resetIdCounter();
});

describe("matchesReviewFilter", () => {
  it("keeps everything under all", () => {
    const item = makeReviewQueueItem({ isContributor: false });
    expect(matchesReviewFilter(item, "all")).toBe(true);
  });

  it("splits contributors from other sources", () => {
    const contributor = makeReviewQueueItem({ isContributor: true });
    const source = makeReviewQueueItem({ isContributor: false });
    expect(matchesReviewFilter(contributor, "contributors")).toBe(true);
    expect(matchesReviewFilter(contributor, "sources")).toBe(false);
    expect(matchesReviewFilter(source, "sources")).toBe(true);
  });
});

describe("selectReviewItems", () => {
  it("orders oldest first", () => {
    const older = makeReviewQueueItem({ createdAt: "2026-08-01T00:00:00.000Z" });
    const newer = makeReviewQueueItem({ createdAt: "2026-09-01T00:00:00.000Z" });
    expect(selectReviewItems([newer, older], "all", "").map((item) => item.createdAt)).toEqual([
      older.createdAt,
      newer.createdAt,
    ]);
  });

  it("matches the card name, the provider and the submitter", () => {
    const items = [
      makeReviewQueueItem({ cardName: "Lux, Lady of Luminosity", submitterName: "Renata" }),
      makeReviewQueueItem({
        cardName: "Jinx, Loose Cannon",
        provider: "playloltcg",
        isContributor: false,
        submitterName: null,
      }),
    ];
    expect(selectReviewItems(items, "all", "lux")).toHaveLength(1);
    expect(selectReviewItems(items, "all", "renata")).toHaveLength(1);
    expect(selectReviewItems(items, "all", "playloltcg")).toHaveLength(1);
    expect(selectReviewItems(items, "all", "zaun")).toHaveLength(0);
  });

  it("returns everything for an empty query", () => {
    const items = [makeReviewQueueItem(), makeReviewQueueItem()];
    expect(selectReviewItems(items, "all", "   ")).toHaveLength(2);
  });
});

describe("countReviewKinds", () => {
  it("counts each kind and zeroes the rest", () => {
    const counts = countReviewKinds([
      makeReviewQueueItem({ kind: "correction" }),
      makeReviewQueueItem({ kind: "correction" }),
      makeReviewQueueItem({ kind: "source" }),
    ]);
    expect(counts).toEqual({ correction: 2, new_card: 0, image: 0, source: 1 });
  });
});

describe("summarizeReviewItem", () => {
  it("joins the non-zero parts", () => {
    const item = makeReviewQueueItem({
      changedFields: 3,
      newPrintings: 1,
      uncheckedPrintings: 0,
    });
    expect(summarizeReviewItem(item)).toBe("3 fields · 1 new printing");
  });

  it("says so when nothing would be applied", () => {
    const item = makeReviewQueueItem({
      changedFields: 0,
      newPrintings: 0,
      uncheckedPrintings: 0,
    });
    expect(summarizeReviewItem(item)).toBe("Nothing to apply");
  });
});

describe("reviewItemTarget", () => {
  const trusted = new Set(["gallery"]);

  it("opens the attention section for a contributor submission", () => {
    expect(reviewItemTarget(makeReviewQueueItem({ cardSlug: "OGN-001" }), trusted)).toEqual({
      kind: "card",
      cardSlug: "OGN-001",
      section: "attention",
    });
  });

  it("opens the attention section for a trusted source", () => {
    const item = makeReviewQueueItem({ isContributor: false, provider: "gallery" });
    expect(reviewItemTarget(item, trusted)).toMatchObject({ section: "attention" });
  });

  it("opens printings for an untrusted source with printing changes", () => {
    const unchecked = makeReviewQueueItem({
      isContributor: false,
      provider: "scraper",
      uncheckedPrintings: 2,
    });
    const fresh = makeReviewQueueItem({
      isContributor: false,
      provider: "scraper",
      newPrintings: 1,
    });
    expect(reviewItemTarget(unchecked, trusted)).toMatchObject({ section: "printings" });
    expect(reviewItemTarget(fresh, trusted)).toMatchObject({ section: "printings" });
  });

  it("opens card fields for an untrusted source with only card changes", () => {
    const item = makeReviewQueueItem({ isContributor: false, provider: "scraper" });
    expect(reviewItemTarget(item, trusted)).toMatchObject({ section: "fields" });
  });

  it("falls back to the draft page keyed by the normalized name", () => {
    const item = makeReviewQueueItem({ cardSlug: null, normName: "lux-lady-of-luminosity" });
    expect(reviewItemTarget(item, trusted)).toEqual({
      kind: "draft",
      name: "lux-lady-of-luminosity",
    });
  });
});
