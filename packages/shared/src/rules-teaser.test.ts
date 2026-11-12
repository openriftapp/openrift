import { describe, expect, it } from "vitest";

import { rulesTeaser } from "./rules-teaser.js";

describe("rulesTeaser", () => {
  it("keeps short text as is", () => {
    expect(rulesTeaser("Draw 1.", 17)).toBe("Draw 1.");
  });

  it("cuts long text at a word boundary", () => {
    expect(rulesTeaser("Your spells and abilities deal 1 Bonus Damage.", 17)).toBe(
      "Your spells and…",
    );
  });

  it("keeps keyword words, drops brackets and italics, and names glyphs", () => {
    expect(rulesTeaser("[Hidden] _(Hide now for :rb_rune_rainbow:.)_", 40)).toBe(
      "Hidden (Hide now for Rainbow rune.)",
    );
  });

  it("hard-cuts a single word longer than the limit", () => {
    expect(rulesTeaser("Supercalifragilistic", 8)).toBe("Superca…");
  });
});
