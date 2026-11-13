import type { OwnedCopyRow } from "@openrift/shared/list-rule-eval";
import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { cardEvalScope, ruleKeepBreakdown } from "./rule-keep-breakdown";

function copy(copyId: string, printingId: string, cardId = "flash"): OwnedCopyRow {
  return { copyId, printingId, cardId, collectionId: "col-1", reserved: false };
}

describe("ruleKeepBreakdown", () => {
  const owned = [
    copy("s1", "std"),
    copy("s2", "std"),
    copy("s3", "std"),
    copy("p1", "promo"),
    copy("p2", "promo"),
    copy("o1", "other-card", "other"),
  ];
  const [s1, s2, , p1, p2] = owned as [
    OwnedCopyRow,
    OwnedCopyRow,
    OwnedCopyRow,
    OwnedCopyRow,
    OwnedCopyRow,
  ];

  it("groups kept, listed and uncovered copies by printing", () => {
    const result = ruleKeepBreakdown(
      "flash",
      owned,
      { kept: [s1, s2, p1], offered: [p2] },
      new Set(["p2"]),
      new Set(),
    );
    expect(result).toEqual({
      kept: [
        { printingId: "std", pinned: false, count: 2 },
        { printingId: "promo", pinned: false, count: 1 },
      ],
      onList: [{ printingId: "promo", pinned: false, count: 1 }],
      outside: [{ printingId: "std", pinned: false, count: 1 }],
    });
  });

  it("trusts the list over the split for what is on it", () => {
    const result = ruleKeepBreakdown(
      "flash",
      owned,
      { kept: [s1, p2], offered: [p1] },
      new Set(["p2", "s3"]),
      new Set(),
    );
    expect(result.onList).toEqual([
      { printingId: "std", pinned: false, count: 1 },
      { printingId: "promo", pinned: false, count: 1 },
    ]);
    expect(result.kept).toEqual([
      { printingId: "std", pinned: false, count: 1 },
      { printingId: "promo", pinned: false, count: 1 },
    ]);
  });

  it("puts pinned copies on their own row", () => {
    const result = ruleKeepBreakdown(
      "flash",
      owned,
      { kept: [s1, s2], offered: [] },
      new Set(),
      new Set(["s1"]),
    );
    expect(result.kept).toEqual([
      { printingId: "std", pinned: true, count: 1 },
      { printingId: "std", pinned: false, count: 1 },
    ]);
  });

  it("counts a double-sided copy once although it has a row per card", () => {
    const doubled = [copy("d1", "ds"), copy("d1", "ds")];
    const result = ruleKeepBreakdown(
      "flash",
      doubled,
      { kept: [], offered: [] },
      new Set(),
      new Set(),
    );
    expect(result.outside).toEqual([{ printingId: "ds", pinned: false, count: 1 }]);
  });

  it("ignores copies of other cards", () => {
    const result = ruleKeepBreakdown(
      "other",
      owned,
      { kept: [], offered: [] },
      new Set(["s1"]),
      new Set(),
    );
    expect(result).toEqual({
      kept: [],
      onList: [],
      outside: [{ printingId: "other-card", pinned: false, count: 1 }],
    });
  });
});

describe("cardEvalScope", () => {
  const catalog = [
    stubPrinting({ printingId: "std", cardId: "flash" }),
    stubPrinting({ printingId: "ds", cardId: "flash" }),
    stubPrinting({ printingId: "ds", cardId: "back" }),
    stubPrinting({ printingId: "other-card", cardId: "other" }),
  ];
  const owned = [
    copy("s1", "std"),
    copy("d1", "ds"),
    copy("d1", "ds", "back"),
    copy("o1", "other-card", "other"),
  ];

  it("keeps both sides of a double-sided copy and drops other cards", () => {
    const scope = cardEvalScope("flash", catalog, owned);
    expect(scope.ownedCopies.map((row) => `${row.copyId}:${row.cardId}`)).toEqual([
      "s1:flash",
      "d1:flash",
      "d1:back",
    ]);
    expect(scope.catalog.map((printing) => `${printing.printingId}:${printing.cardId}`)).toEqual([
      "std:flash",
      "ds:flash",
      "ds:back",
    ]);
  });

  it("is empty for a card with no owned copies", () => {
    expect(cardEvalScope("nobody", catalog, owned)).toEqual({ catalog: [], ownedCopies: [] });
  });
});
