import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { resolvedSide } from "./deck-check-side";

describe("resolvedSide", () => {
  const bird = stubPrinting({ printingId: "pair", side: 1, cardId: "bird" });
  const gold = stubPrinting({ printingId: "pair", side: 2, cardId: "gold" });
  const printingById = { pair: bird };
  const printingsByCardId = new Map([
    ["bird", [bird]],
    ["gold", [gold]],
  ]);

  it("picks the side that shows the resolved card", () => {
    expect(
      resolvedSide(
        { resolvedCardId: "gold", resolvedPrintingId: "pair" },
        printingById,
        printingsByCardId,
      ),
    ).toBe(gold);
  });

  it("falls back to the first side without a resolved card", () => {
    expect(
      resolvedSide(
        { resolvedCardId: null, resolvedPrintingId: "pair" },
        printingById,
        printingsByCardId,
      ),
    ).toBe(bird);
  });

  it("returns nothing for an unresolved line", () => {
    expect(
      resolvedSide(
        { resolvedCardId: null, resolvedPrintingId: null },
        printingById,
        printingsByCardId,
      ),
    ).toBeUndefined();
  });
});
