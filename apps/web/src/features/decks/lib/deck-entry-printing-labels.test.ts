import type { Printing } from "@openrift/shared/types/catalog";
import { describe, expect, it } from "vitest";

import { getDeckCardKey } from "@/features/decks/lib/deck-builder-card";
import { entryPrintingLabels } from "@/features/decks/lib/deck-entry-printing-labels";
import { stubDeckBuilderCard, stubPrinting } from "@/test/factories";

const LABELS = { artVariants: {}, finishes: { foil: "Foil" }, cardSizes: {} };

function labelsFor(
  entries: ReturnType<typeof stubDeckBuilderCard>[],
  printings: Record<string, Printing>,
) {
  return entryPrintingLabels(
    entries,
    (cardId, preferredPrintingId) => printings[preferredPrintingId ?? `${cardId}-default`],
    LABELS,
    "Standard",
    "Default",
  );
}

describe("entryPrintingLabels", () => {
  const standard = stubPrinting({ printingId: "rampage-default", shortCode: "VEN-083" });
  const foil = stubPrinting({ printingId: "rampage-foil", shortCode: "VEN-083", finish: "foil" });

  it("calls an unpinned entry Default and names the pinned one's printing", () => {
    const plain = stubDeckBuilderCard({ cardId: "rampage", quantity: 1 });
    const pinned = stubDeckBuilderCard({
      cardId: "rampage",
      quantity: 1,
      preferredPrintingId: "rampage-default",
    });
    const labels = labelsFor([plain, pinned], { "rampage-default": standard });
    expect(labels.get(getDeckCardKey(plain))).toBe("Default");
    expect(labels.get(getDeckCardKey(pinned))).toBe("Standard");
  });

  it("names the finish when only the finish differs", () => {
    const plain = stubDeckBuilderCard({ cardId: "rampage", quantity: 1 });
    const pinned = stubDeckBuilderCard({
      cardId: "rampage",
      quantity: 1,
      preferredPrintingId: "rampage-foil",
    });
    const labels = labelsFor([plain, pinned], {
      "rampage-default": standard,
      "rampage-foil": foil,
    });
    expect(labels.get(getDeckCardKey(plain))).toBe("Default");
    expect(labels.get(getDeckCardKey(pinned))).toBe("Foil");
  });

  it("names the set code when the codes differ", () => {
    const reprint = stubPrinting({ printingId: "rampage-unl", shortCode: "UNL-012" });
    const plain = stubDeckBuilderCard({ cardId: "rampage", quantity: 1 });
    const pinned = stubDeckBuilderCard({
      cardId: "rampage",
      quantity: 1,
      preferredPrintingId: "rampage-unl",
    });
    const labels = labelsFor([plain, pinned], {
      "rampage-default": standard,
      "rampage-unl": reprint,
    });
    expect(labels.get(getDeckCardKey(plain))).toBe("Default");
    expect(labels.get(getDeckCardKey(pinned))).toBe("UNL-012");
  });

  it("leaves a card alone when the zone holds it once", () => {
    const main = stubDeckBuilderCard({ cardId: "rampage", quantity: 2 });
    const side = stubDeckBuilderCard({
      cardId: "rampage",
      quantity: 1,
      zone: "sideboard",
      preferredPrintingId: "rampage-foil",
    });
    expect(
      labelsFor([main, side], { "rampage-default": standard, "rampage-foil": foil }).size,
    ).toBe(0);
  });
});
