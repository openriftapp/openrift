import { beforeEach, describe, expect, it } from "vitest";

import { resetIdCounter, stubPrinting } from "@/test/factories";

import {
  applyOwnedBucketFilter,
  applyOwnedCountFilter,
  bucketFor,
  maxOwnedCount,
} from "./owned-bucket";

beforeEach(() => {
  resetIdCounter();
});

describe("bucketFor", () => {
  it("returns 'none' when no copies are owned", () => {
    expect(bucketFor(0, 3)).toBe("none");
  });

  it("returns 'partial' when below a full playset", () => {
    expect(bucketFor(1, 3)).toBe("partial");
    expect(bucketFor(2, 3)).toBe("partial");
  });

  it("returns 'full' when exactly at the playset size", () => {
    expect(bucketFor(3, 3)).toBe("full");
    expect(bucketFor(1, 1)).toBe("full");
  });

  it("returns 'extra' when over the playset size", () => {
    expect(bucketFor(4, 3)).toBe("extra");
    expect(bucketFor(2, 1)).toBe("extra");
  });

  it("never returns 'partial' for size-1 cards", () => {
    expect(bucketFor(0, 1)).toBe("none");
    expect(bucketFor(1, 1)).toBe("full");
    expect(bucketFor(2, 1)).toBe("extra");
  });
});

describe("applyOwnedBucketFilter", () => {
  it("returns nothing when no buckets are selected", () => {
    const printing = stubPrinting();
    expect(applyOwnedBucketFilter([printing], [], { [printing.printingId]: 1 })).toEqual([]);
  });

  it("aggregates copies across all variants of the same card", () => {
    const cardId = "card-foo";
    const variantA = stubPrinting({ cardId });
    const variantB = stubPrinting({ cardId });

    const result = applyOwnedBucketFilter([variantA, variantB], ["full"], {
      [variantA.printingId]: 2,
      [variantB.printingId]: 1,
    });

    expect(result.map((p) => p.printingId).toSorted()).toEqual(
      [variantA.printingId, variantB.printingId].toSorted(),
    );
  });

  it("excludes cards whose bucket isn't in the selection", () => {
    const empty = stubPrinting();
    const full = stubPrinting();

    const result = applyOwnedBucketFilter([empty, full], ["partial"], {
      [empty.printingId]: 0,
      [full.printingId]: 3,
    });

    expect(result).toEqual([]);
  });

  it("respects per-card-type playset sizes when bucketing", () => {
    const legend = stubPrinting({ card: { type: "legend", keywords: [] } });

    const fullResult = applyOwnedBucketFilter([legend], ["full"], { [legend.printingId]: 1 });
    const extraResult = applyOwnedBucketFilter([legend], ["extra"], { [legend.printingId]: 1 });

    expect(fullResult).toHaveLength(1);
    expect(extraResult).toHaveLength(0);
  });
});

describe("applyOwnedBucketFilter — per-printing bucketing", () => {
  it("excludes a 0-owned variant even when another variant of the card is owned", () => {
    const cardId = "card-foo";
    const owned = stubPrinting({ cardId });
    const unowned = stubPrinting({ cardId });

    const result = applyOwnedBucketFilter(
      [owned, unowned],
      ["partial", "full", "extra"],
      { [owned.printingId]: 1, [unowned.printingId]: 0 },
      "printing",
    );

    expect(result.map((p) => p.printingId)).toEqual([owned.printingId]);
  });

  it("buckets each printing on its own owned count", () => {
    const cardId = "card-foo";
    const partial = stubPrinting({ cardId });
    const full = stubPrinting({ cardId });

    expect(
      applyOwnedBucketFilter(
        [partial, full],
        ["partial"],
        {
          [partial.printingId]: 1,
          [full.printingId]: 3,
        },
        "printing",
      ).map((p) => p.printingId),
    ).toEqual([partial.printingId]);
    expect(
      applyOwnedBucketFilter(
        [partial, full],
        ["full"],
        {
          [partial.printingId]: 1,
          [full.printingId]: 3,
        },
        "printing",
      ).map((p) => p.printingId),
    ).toEqual([full.printingId]);
  });

  it("contrasts with card mode, which keeps both variants of a partly-owned card", () => {
    const cardId = "card-foo";
    const owned = stubPrinting({ cardId });
    const unowned = stubPrinting({ cardId });
    const counts = { [owned.printingId]: 1, [unowned.printingId]: 0 };

    expect(applyOwnedBucketFilter([owned, unowned], ["partial"], counts)).toHaveLength(2);
    expect(applyOwnedBucketFilter([owned, unowned], ["partial"], counts, "printing")).toHaveLength(
      1,
    );
  });
});

describe("applyOwnedCountFilter", () => {
  it("keeps cards whose owned total is within an inclusive range", () => {
    const one = stubPrinting();
    const three = stubPrinting();
    const five = stubPrinting();
    const counts = { [one.printingId]: 1, [three.printingId]: 3, [five.printingId]: 5 };

    const result = applyOwnedCountFilter([one, three, five], 2, 4, counts);

    expect(result.map((p) => p.printingId)).toEqual([three.printingId]);
  });

  it("treats a null min as zero-and-up and a null max as no upper limit", () => {
    const zero = stubPrinting();
    const two = stubPrinting();
    const ten = stubPrinting();
    const counts = { [zero.printingId]: 0, [two.printingId]: 2, [ten.printingId]: 10 };

    expect(
      applyOwnedCountFilter([zero, two, ten], 2, null, counts).map((p) => p.printingId),
    ).toEqual([two.printingId, ten.printingId]);
    expect(
      applyOwnedCountFilter([zero, two, ten], null, 2, counts).map((p) => p.printingId),
    ).toEqual([zero.printingId, two.printingId]);
    expect(applyOwnedCountFilter([zero, two, ten], null, null, counts)).toHaveLength(3);
  });

  it("aggregates copies across variants in card mode but ranges each printing in printing mode", () => {
    const cardId = "card-foo";
    const variantA = stubPrinting({ cardId });
    const variantB = stubPrinting({ cardId });
    const counts = { [variantA.printingId]: 2, [variantB.printingId]: 1 };

    expect(applyOwnedCountFilter([variantA, variantB], 3, 3, counts)).toHaveLength(2);
    expect(
      applyOwnedCountFilter([variantA, variantB], 2, 2, counts, "printing").map(
        (p) => p.printingId,
      ),
    ).toEqual([variantA.printingId]);
  });

  it("treats a missing count as zero copies owned", () => {
    const tracked = stubPrinting();
    const untracked = stubPrinting();

    expect(
      applyOwnedCountFilter([tracked, untracked], 1, null, { [tracked.printingId]: 1 }).map(
        (p) => p.printingId,
      ),
    ).toEqual([tracked.printingId]);
  });
});

describe("maxOwnedCount", () => {
  it("returns 0 when nothing is owned", () => {
    const printing = stubPrinting();
    expect(maxOwnedCount([printing], {})).toBe(0);
    expect(maxOwnedCount([], { whatever: 5 })).toBe(0);
  });

  it("returns the largest per-card total in card mode (summed across variants)", () => {
    const cardId = "card-foo";
    const variantA = stubPrinting({ cardId });
    const variantB = stubPrinting({ cardId });
    const other = stubPrinting();
    const counts = { [variantA.printingId]: 2, [variantB.printingId]: 3, [other.printingId]: 4 };

    expect(maxOwnedCount([variantA, variantB, other], counts)).toBe(5);
  });

  it("returns the largest single-printing count in printing mode", () => {
    const cardId = "card-foo";
    const variantA = stubPrinting({ cardId });
    const variantB = stubPrinting({ cardId });
    const counts = { [variantA.printingId]: 2, [variantB.printingId]: 3 };

    expect(maxOwnedCount([variantA, variantB], counts, "printing")).toBe(3);
  });
});
