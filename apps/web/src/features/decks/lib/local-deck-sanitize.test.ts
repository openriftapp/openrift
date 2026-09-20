import { WellKnown } from "@openrift/shared/well-known";
import { describe, expect, it } from "vitest";

import type { LocalDeck, LocalDeckCard } from "@/features/decks/lib/local-deck";
import { bareLocalDeckId, sanitizeDecks } from "@/features/decks/lib/local-deck-sanitize";

const sampleCards: LocalDeckCard[] = [
  { zone: "legend", cardId: "card-legend", quantity: 1, preferredPrintingId: null },
  { zone: "main", cardId: "card-a", quantity: 3, preferredPrintingId: "printing-a" },
];

const validDeck: LocalDeck = {
  id: "abc",
  name: "My Deck",
  description: "notes",
  format: WellKnown.deckFormat.CUSTOM_REGION,
  formatConfig: { tagSlugs: ["bandle-city"] },
  cards: sampleCards,
  coverCardId: null,
  coverPrintingId: null,
  coverPosition: null,
  links: [],
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
};

describe("bareLocalDeckId", () => {
  it("strips the retired prefix and leaves a bare id alone", () => {
    expect(bareLocalDeckId("local:abc")).toBe("abc");
    expect(bareLocalDeckId("abc")).toBe("abc");
  });

  it("only strips a leading prefix", () => {
    expect(bareLocalDeckId("deck-local:1")).toBe("deck-local:1");
    expect(bareLocalDeckId("LOCAL:abc")).toBe("LOCAL:abc");
  });
});

describe("sanitizeDecks", () => {
  it("keeps a well-formed deck untouched", () => {
    expect(sanitizeDecks({ abc: validDeck })).toEqual({ abc: validDeck });
  });

  it("re-keys a legacy `local:` entry onto the uuid it wrapped", () => {
    const decks = sanitizeDecks({ "local:abc": { ...validDeck, id: "local:abc" } });

    expect(Object.keys(decks)).toEqual(["abc"]);
    expect(decks.abc?.id).toBe("abc");
  });

  it("returns an empty record for non-object blobs", () => {
    expect(sanitizeDecks(null)).toEqual({});
    expect(sanitizeDecks("corrupt")).toEqual({});
    expect(sanitizeDecks([validDeck])).toEqual({});
  });

  it("keeps the valid decks when a sibling entry is corrupt", () => {
    const decks = sanitizeDecks({ abc: validDeck, broken: "not a deck" });

    expect(Object.keys(decks)).toEqual(["abc"]);
  });

  it("salvages a deck with malformed cosmetic fields", () => {
    const decks = sanitizeDecks({
      abc: { ...validDeck, name: 42, description: null, format: undefined },
    });

    const deck = decks.abc!;
    expect(deck.name).toBe("Recovered deck");
    expect(deck.description).toBe("");
    expect(deck.format).toBe(WellKnown.deckFormat.CONSTRUCTED);
    expect(deck.cards).toEqual(sampleCards);
  });

  it("drops malformed card rows but keeps the valid ones", () => {
    const decks = sanitizeDecks({
      abc: {
        ...validDeck,
        cards: [
          sampleCards[0],
          { zone: "main", cardId: 7, quantity: 1, preferredPrintingId: null },
          { zone: "main", cardId: "card-b", quantity: 0, preferredPrintingId: null },
          { zone: "main", cardId: "card-c", quantity: 2.9, preferredPrintingId: 5 },
          "garbage",
        ],
      },
    });

    expect(decks.abc!.cards).toEqual([
      sampleCards[0],
      { zone: "main", cardId: "card-c", quantity: 2, preferredPrintingId: null },
    ]);
  });

  it("keeps zones and formats this bundle doesn't know", () => {
    const decks = sanitizeDecks({
      abc: {
        ...validDeck,
        format: "future-format",
        cards: [{ zone: "future-zone", cardId: "card-x", quantity: 1, preferredPrintingId: null }],
      },
    });

    expect(decks.abc!.format).toBe("future-format");
    expect(decks.abc!.cards[0]!.zone).toBe("future-zone");
  });

  it("replaces a non-array cards value with an empty list", () => {
    expect(sanitizeDecks({ abc: { ...validDeck, cards: "corrupt" } }).abc!.cards).toEqual([]);
  });

  it("keeps well-formed links and their titles", () => {
    const decks = sanitizeDecks({
      abc: {
        ...validDeck,
        links: [
          { url: "https://youtu.be/abc123", title: "Guide" },
          { url: "https://riftmana.com/deck/1" },
        ],
      },
    });

    expect(decks.abc!.links).toEqual([
      { url: "https://youtu.be/abc123", title: "Guide" },
      { url: "https://riftmana.com/deck/1" },
    ]);
  });

  it("drops links that fail the host allowlist", () => {
    const decks = sanitizeDecks({
      abc: { ...validDeck, links: [{ url: "https://not-allowed.invalid/deck" }] },
    });

    expect(decks.abc!.links).toEqual([]);
  });

  it("lifts a pre-links `videoUrl` into the first link", () => {
    const { links: _links, ...withoutLinks } = validDeck;
    const decks = sanitizeDecks({
      abc: { ...withoutLinks, videoUrl: "https://youtu.be/abc123" },
    });

    expect(decks.abc!.links[0]?.url).toBe("https://youtu.be/abc123");
  });
});
