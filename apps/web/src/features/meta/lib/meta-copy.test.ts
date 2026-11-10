import { describe, expect, it } from "vitest";

import { META_DECKS_DESCRIPTION } from "./meta-copy";

describe("META_DECKS_DESCRIPTION", () => {
  it("claims nothing about the reader's collection, which signed-out readers do not see", () => {
    expect(META_DECKS_DESCRIPTION).not.toMatch(/\bown/iu);
  });
});
