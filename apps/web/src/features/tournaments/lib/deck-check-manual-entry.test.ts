import { getDeckFromCode } from "@piltoverarchive/riftbound-deck-codes";
import { describe, expect, it, vi } from "vitest";

import { parseDeckPaste, parseManualDecklist } from "./deck-check-manual-entry";

vi.mock("@piltoverarchive/riftbound-deck-codes", () => ({
  getDeckFromCode: vi.fn(),
}));

const mockGetDeckFromCode = vi.mocked(getDeckFromCode);

describe("parseDeckPaste", () => {
  it("treats a single token as a deck code and counts its copies", () => {
    mockGetDeckFromCode.mockReturnValueOnce({
      mainDeck: [
        { cardCode: "OGN-001", count: 3 },
        { cardCode: "OGN-002", count: 2 },
      ],
      sideboard: [{ cardCode: "OGN-003", count: 1 }],
    });

    expect(parseDeckPaste("  CMAAAAABAEAABJQB  ")).toEqual({
      kind: "code",
      deckCode: "CMAAAAABAEAABJQB",
      totalCopies: 6,
      warnings: [],
    });
  });

  it("warns on a token that does not decode", () => {
    mockGetDeckFromCode.mockImplementation(() => {
      throw new Error("invalid code");
    });

    const parsed = parseDeckPaste("NOTACODE");
    expect(parsed).toMatchObject({ kind: "code", deckCode: "NOTACODE", totalCopies: 0 });
    expect(parsed.warnings.length).toBeGreaterThan(0);
  });

  it("parses a multi-line paste as a text list", () => {
    expect(parseDeckPaste("Main:\n3 Some Card")).toEqual({
      kind: "list",
      cards: [{ name: "Some Card", quantity: 3, section: "main" }],
      totalCopies: 3,
      warnings: [],
    });
  });
});

describe("parseManualDecklist", () => {
  it("parses zone headers into section slugs", () => {
    const { cards, totalCopies } = parseManualDecklist(
      ["Champion:", "1 Some Champion", "Main:", "3 Some Card", "Sideboard:", "2 Tech Card"].join(
        "\n",
      ),
    );
    expect(cards).toEqual([
      { name: "Some Champion", quantity: 1, section: "champion" },
      { name: "Some Card", quantity: 3, section: "main" },
      { name: "Tech Card", quantity: 2, section: "sideboard" },
    ]);
    expect(totalCopies).toBe(6);
  });

  it("defaults lines without a header to the main deck", () => {
    const { cards } = parseManualDecklist("2 Lone Card");
    expect(cards).toEqual([{ name: "Lone Card", quantity: 2, section: "main" }]);
  });

  it("treats a bare line with no leading count as a single copy", () => {
    const { cards } = parseManualDecklist("Just A Name");
    expect(cards).toEqual([{ name: "Just A Name", quantity: 1, section: "main" }]);
  });

  it("skips blank lines and merges identical name+zone lines", () => {
    const { cards, totalCopies } = parseManualDecklist(
      ["Main:", "2 Repeated Card", "", "1 Repeated Card", "1 Other Card"].join("\n"),
    );
    expect(cards).toEqual([
      { name: "Repeated Card", quantity: 3, section: "main" },
      { name: "Other Card", quantity: 1, section: "main" },
    ]);
    expect(totalCopies).toBe(4);
  });

  it("keeps the same card in different zones as separate lines", () => {
    const { cards } = parseManualDecklist(
      ["Main:", "3 Versatile Card", "Sideboard:", "2 Versatile Card"].join("\n"),
    );
    expect(cards).toEqual([
      { name: "Versatile Card", quantity: 3, section: "main" },
      { name: "Versatile Card", quantity: 2, section: "sideboard" },
    ]);
  });

  it("warns on an unknown zone header without dropping later cards", () => {
    const { cards, warnings } = parseManualDecklist(["Bogus:", "1 Stray Card"].join("\n"));
    expect(warnings.some((warning) => warning.includes("Bogus:"))).toBe(true);
    expect(cards).toEqual([{ name: "Stray Card", quantity: 1, section: "main" }]);
  });

  it("returns an empty result with a warning for empty input", () => {
    const { cards, totalCopies, warnings } = parseManualDecklist("   ");
    expect(cards).toEqual([]);
    expect(totalCopies).toBe(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
