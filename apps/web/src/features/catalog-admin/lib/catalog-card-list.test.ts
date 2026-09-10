import { describe, expect, it } from "vitest";

import type { PriceAssignBucket } from "@/features/cards/lib/marketplace-coverage";
import { makeCatalogCardRow } from "@/test/factories";

import {
  cardAttentionBadges,
  cardsListParams,
  cardsListSearch,
  catalogCardKey,
  catalogCardNeighbours,
  matchesCardIssue,
  matchesCardSegment,
  scopeCardCounts,
  scopeKeysInOrder,
  segmentCounts,
  selectCatalogCards,
  unlinkedProductCount,
  visibleIssues,
} from "./catalog-card-list";

function bucket(overrides: Partial<PriceAssignBucket> = {}): PriceAssignBucket {
  return { marketplace: "cardmarket", language: null, unbound: 2, assignable: true, ...overrides };
}

describe("catalogCardKey", () => {
  it("keys a draft by its normalized name", () => {
    const draft = makeCatalogCardRow({ cardSlug: null, normName: "ambessa-chosen-of-the-wolf" });
    expect(catalogCardKey(draft)).toBe("draft:ambessa-chosen-of-the-wolf");
  });

  it("keys a live card by its slug", () => {
    expect(catalogCardKey(makeCatalogCardRow({ cardSlug: "jinx-loose-cannon" }))).toBe(
      "jinx-loose-cannon",
    );
  });
});

describe("matchesCardSegment", () => {
  it("keeps everything under all", () => {
    expect(matchesCardSegment(makeCatalogCardRow({ needsAttention: false }), "all")).toBe(true);
  });

  it("keeps only rows the server flagged under attention", () => {
    expect(matchesCardSegment(makeCatalogCardRow({ needsAttention: true }), "attention")).toBe(
      true,
    );
    expect(matchesCardSegment(makeCatalogCardRow({ needsAttention: false }), "attention")).toBe(
      false,
    );
  });

  it("keeps only slugless rows under drafts", () => {
    expect(matchesCardSegment(makeCatalogCardRow({ cardSlug: null }), "drafts")).toBe(true);
    expect(matchesCardSegment(makeCatalogCardRow({ cardSlug: "vi-enforcer" }), "drafts")).toBe(
      false,
    );
  });
});

describe("matchesCardIssue", () => {
  it("reads each server count", () => {
    const row = makeCatalogCardRow({
      proposals: 1,
      newPrintings: 0,
      printingsWithoutImage: 2,
      uncheckedTrustedProviders: ["gallery"],
    });
    expect(matchesCardIssue(row, "proposals", "all")).toBe(true);
    expect(matchesCardIssue(row, "new-printings", "all")).toBe(false);
    expect(matchesCardIssue(row, "no-image", "all")).toBe(true);
    expect(matchesCardIssue(row, "unchecked-source", "all")).toBe(true);
  });

  it("reads unlinked products from the client-side buckets", () => {
    const row = makeCatalogCardRow({ cardSlug: "ekko-time-winder" });
    const buckets = () => [bucket({ marketplace: "cardtrader", language: "FR" })];
    expect(matchesCardIssue(row, "unlinked-products", "cardtrader:FR", buckets)).toBe(true);
    expect(matchesCardIssue(row, "unlinked-products", "cardmarket", buckets)).toBe(false);
  });

  it("stands down while the marketplace corpus has not loaded", () => {
    expect(matchesCardIssue(makeCatalogCardRow(), "unlinked-products", "all")).toBe(true);
  });

  it("matches nothing once a lookup exists but the card has no buckets", () => {
    expect(
      matchesCardIssue(makeCatalogCardRow(), "unlinked-products", "all", () => undefined),
    ).toBe(false);
  });
});

describe("cardsListParams", () => {
  it("defaults the segment and the scope", () => {
    expect(cardsListParams({}, true)).toEqual({
      segment: "all",
      issue: undefined,
      scope: "all",
      set: undefined,
      q: undefined,
    });
  });

  it("drops unlinked products for an operator who cannot see them", () => {
    const params = cardsListParams({ issue: "unlinked-products", scope: "cardtrader:FR" }, false);
    expect(params.issue).toBeUndefined();
    expect(params.scope).toBe("all");
  });

  it("keeps the scope only while unlinked products is the issue", () => {
    expect(cardsListParams({ issue: "unlinked-products", scope: "cardmarket" }, true).scope).toBe(
      "cardmarket",
    );
    expect(cardsListParams({ issue: "proposals", scope: "cardmarket" }, true).scope).toBe("all");
  });
});

describe("cardsListSearch", () => {
  it("leaves defaults out of the URL", () => {
    expect(cardsListSearch(cardsListParams({}, true))).toEqual({
      from: "cards",
      segment: undefined,
      issue: undefined,
      scope: undefined,
      set: undefined,
      q: undefined,
    });
  });

  it("carries the sanitized filters", () => {
    const search = cardsListSearch(
      cardsListParams(
        { segment: "drafts", issue: "unlinked-products", scope: "cardmarket", set: "ogn", q: "vi" },
        true,
      ),
    );
    expect(search).toEqual({
      from: "cards",
      segment: "drafts",
      issue: "unlinked-products",
      scope: "cardmarket",
      set: "ogn",
      q: "vi",
    });
  });
});

describe("visibleIssues", () => {
  it("hides unlinked products from an operator without marketplace reach", () => {
    expect(visibleIssues(false)).not.toContain("unlinked-products");
    expect(visibleIssues(true)).toContain("unlinked-products");
  });
});

describe("segmentCounts", () => {
  it("tallies each segment", () => {
    const rows = [
      makeCatalogCardRow({ name: "Jinx, Loose Cannon", needsAttention: true }),
      makeCatalogCardRow({ cardSlug: null, name: "Ambessa, Chosen", needsAttention: true }),
      makeCatalogCardRow({ name: "Vi, Enforcer" }),
    ];
    expect(segmentCounts(rows, {})).toEqual({ all: 3, attention: 2, drafts: 1 });
  });

  it("narrows to the set and the search so the toggle agrees with the list", () => {
    const rows = [
      makeCatalogCardRow({ name: "Jinx, Loose Cannon", setSlugs: ["ogn"], needsAttention: true }),
      makeCatalogCardRow({ name: "Caitlyn, Sheriff", setSlugs: ["sfd"] }),
    ];
    expect(segmentCounts(rows, { set: "ogn" })).toEqual({ all: 1, attention: 1, drafts: 0 });
    expect(segmentCounts(rows, { q: "caitlyn" })).toEqual({ all: 1, attention: 0, drafts: 0 });
  });
});

describe("unlinkedProductCount", () => {
  it("sums only assignable buckets under the umbrella scope", () => {
    const buckets = [
      bucket({ unbound: 3 }),
      bucket({ marketplace: "cardtrader", language: "DE", unbound: 5, assignable: false }),
    ];
    expect(unlinkedProductCount(buckets, "all")).toBe(3);
  });

  it("sums one marketplace and language under a named scope", () => {
    const buckets = [
      bucket({ unbound: 3 }),
      bucket({ marketplace: "cardtrader", language: "DE", unbound: 5, assignable: false }),
    ];
    expect(unlinkedProductCount(buckets, "cardtrader:DE")).toBe(5);
  });

  it("counts nothing without buckets", () => {
    expect(unlinkedProductCount(undefined, "all")).toBe(0);
  });
});

describe("selectCatalogCards", () => {
  it("orders by name", () => {
    const rows = [
      makeCatalogCardRow({ name: "Vi, Enforcer" }),
      makeCatalogCardRow({ name: "Ekko, Time Winder" }),
    ];
    expect(selectCatalogCards(rows, { segment: "all" }).map((row) => row.name)).toEqual([
      "Ekko, Time Winder",
      "Vi, Enforcer",
    ]);
  });

  it("matches the name and the short codes", () => {
    const rows = [
      makeCatalogCardRow({ name: "Jinx, Loose Cannon", shortCodes: ["OGN-042"] }),
      makeCatalogCardRow({ name: "Vi, Enforcer", shortCodes: ["OGN-118"] }),
    ];
    expect(selectCatalogCards(rows, { segment: "all", q: "jinx" })).toHaveLength(1);
    expect(selectCatalogCards(rows, { segment: "all", q: "OGN-118" })).toHaveLength(1);
    expect(selectCatalogCards(rows, { segment: "all", q: "zaun" })).toHaveLength(0);
  });

  it("filters by set membership", () => {
    const rows = [
      makeCatalogCardRow({ name: "Jinx, Loose Cannon", setSlugs: ["ogn"] }),
      makeCatalogCardRow({ name: "Caitlyn, Sheriff", setSlugs: ["ogn", "sfd"] }),
    ];
    expect(selectCatalogCards(rows, { segment: "all", set: "sfd" }).map((r) => r.name)).toEqual([
      "Caitlyn, Sheriff",
    ]);
  });

  it("composes the segment, the issue and the search", () => {
    const rows = [
      makeCatalogCardRow({ name: "Jinx, Loose Cannon", needsAttention: true, proposals: 1 }),
      makeCatalogCardRow({ name: "Vi, Enforcer", needsAttention: true, newPrintings: 1 }),
      makeCatalogCardRow({ name: "Ekko, Time Winder", proposals: 1 }),
    ];
    const selected = selectCatalogCards(rows, {
      segment: "attention",
      issue: "proposals",
      q: "jinx",
    });
    expect(selected.map((row) => row.name)).toEqual(["Jinx, Loose Cannon"]);
  });
});

describe("catalogCardNeighbours", () => {
  it("walks the filtered list", () => {
    const rows = selectCatalogCards(
      [
        makeCatalogCardRow({ cardSlug: "vi-enforcer", name: "Vi, Enforcer" }),
        makeCatalogCardRow({ cardSlug: "ekko-time-winder", name: "Ekko, Time Winder" }),
        makeCatalogCardRow({ cardSlug: "jinx-loose-cannon", name: "Jinx, Loose Cannon" }),
      ],
      { segment: "all" },
    );
    const { prev, next } = catalogCardNeighbours(rows, "jinx-loose-cannon");
    expect(prev?.cardSlug).toBe("ekko-time-winder");
    expect(next?.cardSlug).toBe("vi-enforcer");
  });

  it("has no neighbours at the ends", () => {
    const rows = [makeCatalogCardRow({ cardSlug: "vi-enforcer" })];
    expect(catalogCardNeighbours(rows, "vi-enforcer")).toEqual({ prev: null, next: null });
  });

  it("has no neighbours for a card outside the list", () => {
    const rows = [makeCatalogCardRow({ cardSlug: "vi-enforcer" })];
    expect(catalogCardNeighbours(rows, "heimerdinger-professor")).toEqual({
      prev: null,
      next: null,
    });
  });
});

describe("cardAttentionBadges", () => {
  it("says nothing for a clean card", () => {
    expect(cardAttentionBadges(makeCatalogCardRow())).toEqual([]);
  });

  it("names every kind of attention in words", () => {
    const row = makeCatalogCardRow({
      proposals: 2,
      newPrintings: 1,
      uncheckedTrustedProviders: ["gallery", "playloltcg"],
      printingsWithoutImage: 1,
    });
    expect(cardAttentionBadges(row, 3).map((badge) => badge.label)).toEqual([
      "2 proposals",
      "1 new printing",
      "unchecked: gallery, playloltcg",
      "no image",
      "3 products unlinked",
    ]);
  });

  it("leaves unlinked products out when the count is zero", () => {
    const badges = cardAttentionBadges(makeCatalogCardRow({ proposals: 1 }), 0);
    expect(badges.map((badge) => badge.key)).toEqual(["proposals"]);
  });
});

describe("scopeCardCounts", () => {
  it("counts each card once per scope", () => {
    const rows = [
      makeCatalogCardRow({ cardSlug: "jinx-loose-cannon" }),
      makeCatalogCardRow({ cardSlug: "vi-enforcer" }),
    ];
    const counts = scopeCardCounts(rows, (slug) =>
      slug === "jinx-loose-cannon"
        ? [bucket(), bucket({ unbound: 1 }), bucket({ marketplace: "cardtrader", language: "FR" })]
        : [bucket()],
    );
    expect(counts.get("cardmarket")).toBe(2);
    expect(counts.get("cardtrader:FR")).toBe(1);
  });

  it("skips buckets with nothing unbound", () => {
    const counts = scopeCardCounts([makeCatalogCardRow()], () => [bucket({ unbound: 0 })]);
    expect(counts.size).toBe(0);
  });

  it("orders Cardmarket, then TCGplayer, then CardTrader by language", () => {
    const counts = new Map([
      ["cardtrader:FR", 1],
      ["tcgplayer", 1],
      ["cardtrader:DE", 1],
      ["cardmarket", 1],
    ]);
    expect(scopeKeysInOrder(counts)).toEqual([
      "cardmarket",
      "tcgplayer",
      "cardtrader:DE",
      "cardtrader:FR",
    ]);
  });
});
