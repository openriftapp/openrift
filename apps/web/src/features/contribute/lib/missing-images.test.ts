import type { MissingImagePrinting } from "@openrift/shared/contracts/card-submissions";
import { describe, expect, it } from "vitest";

import { otherMissingImages } from "./missing-images";

function printing(printingId: string): MissingImagePrinting {
  return {
    printingId,
    side: 1,
    cardSlug: `slug-${printingId}`,
    cardName: `Card ${printingId}`,
    setSlug: "ogn",
    setName: "Origins",
    shortCode: `OGN-${printingId}`,
    publicCode: `OGN-${printingId}`,
    finish: "normal",
    language: "EN",
    copies: 1,
  };
}

describe("otherMissingImages", () => {
  it("drops the current printing and keeps the order", () => {
    const items = [printing("a"), printing("b"), printing("c")];

    expect(
      otherMissingImages(items, { printingId: "b", cardSlug: "slug-b" }).map(
        (item) => item.printingId,
      ),
    ).toEqual(["a", "c"]);
  });

  it("keeps every item when the current printing is not in the list", () => {
    const items = [printing("a"), printing("b")];

    expect(otherMissingImages(items, { printingId: "gone", cardSlug: "slug-gone" })).toHaveLength(
      2,
    );
  });

  it("returns nothing when only the current printing is left", () => {
    expect(otherMissingImages([printing("a")], { printingId: "a", cardSlug: "slug-a" })).toEqual(
      [],
    );
  });

  it("returns nothing for an empty list", () => {
    expect(otherMissingImages([], { printingId: "a", cardSlug: "slug-a" })).toEqual([]);
  });

  it("keeps the other card of the same double-sided printing", () => {
    const bird = { ...printing("pair"), cardSlug: "bird" };
    const gold = { ...printing("pair"), side: 2 as const, cardSlug: "gold" };

    expect(otherMissingImages([bird, gold], { printingId: "pair", cardSlug: "bird" })).toEqual([
      gold,
    ]);
  });
});
