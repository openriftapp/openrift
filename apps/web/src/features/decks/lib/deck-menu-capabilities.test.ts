import { describe, expect, it } from "vitest";

import { deckMenuCapabilities } from "./deck-menu-capabilities";

describe("deckMenuCapabilities", () => {
  it("offers every account action on a server deck", () => {
    expect(Object.values(deckMenuCapabilities("server")).every(Boolean)).toBe(true);
  });

  it("hides every account action on a browser-local deck", () => {
    expect(Object.values(deckMenuCapabilities("local")).some(Boolean)).toBe(false);
  });
});
