import { describe, expect, it } from "vitest";

import { bareLocalDeckId } from "@/features/decks/lib/local-deck";

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
