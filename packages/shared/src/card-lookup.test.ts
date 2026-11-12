import { describe, expect, it } from "vitest";

import type { LookupCardInput, LookupPrintingInput } from "./card-lookup.js";
import { buildCardLookupIndex, buildPrintingLookupIndex } from "./card-lookup.js";
import { resolveCard, searchCards } from "./card-search.js";
import { WellKnown } from "./well-known.js";

const azir: LookupCardInput = {
  id: "azir",
  slug: "emperor-of-the-sands",
  name: "Emperor of the Sands",
  types: [WellKnown.cardType.LEGEND],
  tags: ["Azir"],
};
const bird: LookupCardInput = {
  id: "bird",
  slug: "bird",
  name: "Bird",
  types: [WellKnown.cardType.UNIT],
  tags: [],
};
const brush: LookupCardInput = {
  id: "brush",
  slug: "brush",
  name: "Brush",
  types: [WellKnown.cardType.UNIT],
  tags: [],
};
const badge: LookupCardInput = {
  id: "badge",
  slug: "badge",
  name: "Badge",
  types: [WellKnown.cardType.GEAR],
  tags: [],
};

const printings: LookupPrintingInput[] = [
  { cardId: "azir", shortCode: "SFD-001", publicCode: "SFD-001/221", printedName: null },
  {
    cardId: "azir",
    shortCode: "SFD-201",
    publicCode: "SFD-201/221",
    printedName: "Kaiser der Sande",
  },
  { cardId: "bird", shortCode: "UNL-T02", publicCode: "UNL-T02-P", printedName: null },
  { cardId: "brush", shortCode: "UNL-T03", publicCode: "UNL-T03-P", printedName: null },
];

describe("buildCardLookupIndex", () => {
  const index = buildCardLookupIndex([azir, bird, brush, badge], printings);

  it("finds a card by the printed name of any of its printings", () => {
    expect(searchCards(index, "kaiser der sande", 5).map((row) => row.id)).toEqual(["azir"]);
  });

  it("finds a card by the code of any of its printings", () => {
    expect(searchCards(index, "SFD-201", 5).map((row) => row.id)).toEqual(["azir"]);
  });

  it("resolves the colloquial legend name and exposes it as the display name", () => {
    const resolution = resolveCard(index, "Azir, Emperor of the Sands");
    expect(resolution.status).toBe("matched");
    expect(resolution.status === "matched" && resolution.card.displayName).toBe(
      "Azir, Emperor of the Sands",
    );
  });

  it("ranks ties by display name, so a legend files under its champion", () => {
    const ordered = buildCardLookupIndex([badge, azir], []).entries.map((entry) => entry.card.id);
    expect(ordered).toEqual(["azir", "badge"]);
  });

  it("keeps each side of a double-sided printing its own card with its own code", () => {
    expect(searchCards(index, "UNL-T03", 5).map((row) => row.id)).toEqual(["brush"]);
    expect(searchCards(index, "bird", 5).map((row) => row.id)).toEqual(["bird"]);
  });
});

describe("buildPrintingLookupIndex", () => {
  const entries = printings.map((printing) => ({
    ...printing,
    card: [azir, bird, brush].find((card) => card.id === printing.cardId) ?? azir,
  }));
  const index = buildPrintingLookupIndex(entries, (entry) => ({
    id: entry.shortCode,
    slug: entry.shortCode,
  }));

  it("finds one row per entry by its own code only", () => {
    expect(searchCards(index, "SFD-201", 5).map((row) => row.id)).toEqual(["SFD-201"]);
  });

  it("finds a row by its own printed name and carries the entry", () => {
    const [row] = searchCards(index, "kaiser", 5);
    expect(row?.printing.shortCode).toBe("SFD-201");
    expect(row?.displayName).toBe("Azir, Emperor of the Sands");
  });
});
