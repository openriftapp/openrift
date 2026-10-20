import { describe, expect, it } from "vitest";

import { deckCardDetailKeys } from "./meta-deck-side-keys";

describe("deckCardDetailKeys", () => {
  const keyOf = deckCardDetailKeys([
    { printingId: "pair", side: 1, cardId: "bird" },
    { printingId: "pair", side: 2, cardId: "gold" },
  ]);

  it("opens the side that shows the card", () => {
    expect(keyOf({ cardId: "gold", printingId: "pair" })).toBe("pair:2");
    expect(keyOf({ cardId: "bird", printingId: "pair" })).toBe("pair");
  });

  it("falls back to the printing id and passes a missing printing through", () => {
    expect(keyOf({ cardId: "brush", printingId: "solo" })).toBe("solo");
    expect(keyOf({ cardId: "brush", printingId: null })).toBeNull();
  });
});
