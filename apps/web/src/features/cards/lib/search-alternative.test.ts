import { describe, expect, it } from "vitest";

import { searchAlternative } from "./search-alternative";

describe("searchAlternative", () => {
  it("offers a card text search", () => {
    expect(searchAlternative("stun")).toBe("o:stun");
    expect(searchAlternative("deal 3 damage")).toBe('o:"deal 3 damage"');
  });

  it("keeps a quoted phrase together", () => {
    expect(searchAlternative('"draw a card"')).toBe('o:"draw a card"');
  });

  it("offers nothing when every word is a card number, which bare words already match", () => {
    expect(searchAlternative("OGN-202")).toBeNull();
    expect(searchAlternative("pgn-123f ogn202")).toBeNull();
  });

  it("offers nothing for an empty query or one with keys", () => {
    expect(searchAlternative("")).toBeNull();
    expect(searchAlternative("t:unit stun")).toBeNull();
    expect(searchAlternative("-stun")).toBeNull();
    expect(searchAlternative("stun or shield")).toBeNull();
  });
});
