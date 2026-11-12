import { describe, expect, it } from "vitest";

import { buildCodeIndex } from "./card-search.js";
import type { DeckCodeCard } from "./deck-code-resolve.js";
import { resolveDeckCodeEntries } from "./deck-code-resolve.js";
import type { DeckImportEntry } from "./deck-code.js";
import { WellKnown } from "./well-known.js";

const legend: DeckCodeCard & { id: string } = {
  id: "azir",
  types: [WellKnown.cardType.LEGEND],
  superTypes: [],
};
const unit: DeckCodeCard & { id: string } = {
  id: "guard",
  types: [WellKnown.cardType.UNIT],
  superTypes: [],
};

const codeIndex = buildCodeIndex([
  { card: legend, printing: { shortCode: "SFD-001", publicCode: "SFD-001/221" } },
  { card: unit, printing: { shortCode: "OGN-010", publicCode: "OGN-010/298" } },
]);

function entry(overrides: Partial<DeckImportEntry>): DeckImportEntry {
  return { quantity: 1, sourceSlot: "mainDeck", rawFields: {}, ...overrides };
}

describe("resolveDeckCodeEntries", () => {
  it("matches codes regardless of case and punctuation, and public codes too", () => {
    const resolved = resolveDeckCodeEntries(
      [entry({ shortCode: "sfd001" }), entry({ shortCode: "OGN-010/298" })],
      codeIndex,
    );
    expect(resolved.rows.map((row) => row.card.id)).toEqual(["azir", "guard"]);
    expect(resolved.unknownCodes).toEqual([]);
  });

  it("infers the zone from the card unless the entry names one", () => {
    const resolved = resolveDeckCodeEntries(
      [
        entry({ shortCode: "SFD-001" }),
        entry({ shortCode: "OGN-010", explicitZone: WellKnown.deckZone.SIDEBOARD }),
      ],
      codeIndex,
    );
    expect(resolved.rows.map((row) => row.zone)).toEqual([
      WellKnown.deckZone.LEGEND,
      WellKnown.deckZone.SIDEBOARD,
    ]);
  });

  it("reports unknown codes and skips entries without one", () => {
    const resolved = resolveDeckCodeEntries(
      [entry({ shortCode: "XXX-999" }), entry({ cardName: "Nameless" })],
      codeIndex,
    );
    expect(resolved.rows).toEqual([]);
    expect(resolved.unknownCodes).toEqual(["XXX-999"]);
  });
});
