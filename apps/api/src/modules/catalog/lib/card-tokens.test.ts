import { describe, expect, it } from "vitest";

import { findTokenReferences } from "./card-tokens.js";

const TOKENS = [
  { cardId: "baron-pit", name: "Baron Pit" },
  { cardId: "bird", name: "Bird" },
  { cardId: "brush", name: "Brush" },
  { cardId: "buff", name: "Buff" },
  { cardId: "gold", name: "Gold" },
  { cardId: "mech", name: "Mech" },
  { cardId: "recruit", name: "Recruit" },
  { cardId: "reflection", name: "Reflection" },
  { cardId: "sand-soldier", name: "Sand Soldier" },
  { cardId: "shadow-clone", name: "Shadow Clone" },
  { cardId: "sprite", name: "Sprite" },
  { cardId: "tentacle", name: "Tentacle" },
  { cardId: "xp-tracker", name: "XP Tracker" },
];

const CARD_TYPES = ["legend", "unit", "rune", "spell", "gear", "battlefield", "other"];

const OWNER = "some-card";

function find(...texts: (string | null | undefined)[]): string[] {
  return findTokenReferences(texts, TOKENS, CARD_TYPES, OWNER);
}

describe("findTokenReferences", () => {
  describe("real printing text", () => {
    it.each([
      {
        name: "a typed reference behind glyph markup",
        text: ":rb_energy_1: :rb_rune_fury:, Recycle a unit from your trash, :rb_exhaust:: Play a 3 :rb_might: Mech unit token to your base.",
        expected: ["mech"],
      },
      {
        name: "a gear token",
        text: ":rb_energy_1:, :rb_exhaust:: Return a friendly unit at a battlefield to its owner's hand. Play a Gold gear token exhausted.",
        expected: ["gold"],
      },
      {
        name: "a battlefield token mid-sentence",
        text: "As you play me, add the Baron Pit battlefield token to the board if it's not there already. If you do, I enter there.",
        expected: ["baron-pit"],
      },
      {
        name: "a plural reference",
        text: ":rb_exhaust:: Play three 1 :rb_might: Recruit unit tokens.",
        expected: ["recruit"],
      },
      {
        name: "a reference followed by a keyword bracket",
        text: ":rb_energy_4:, :rb_exhaust:: Play a ready 3 :rb_might: Sprite unit token with [Temporary]. This ability costs :rb_energy_1: less for each friendly unit with [Temporary].",
        expected: ["sprite"],
      },
      {
        name: "a reference without the type word",
        text: "Play a Recruit token.",
        expected: ["recruit"],
      },
    ])("matches $name", ({ text, expected }) => {
      expect(find(text)).toEqual(expected);
    });
  });

  describe("implicit tokens", () => {
    it.each([
      {
        name: "derives Buff from the verb, which is how every buff card is written",
        text: ":rb_energy_1:, :rb_exhaust:: Buff a friendly unit. _(If it doesn't have a buff, it gets a +1 :rb_might: buff.)_",
        expected: ["buff"],
      },
      {
        name: "derives Buff from a rules line about buffs",
        text: "A unit may have no more than one buff at a time.",
        expected: ["buff"],
      },
      {
        name: "derives XP Tracker from a level gate",
        text: "[Level 6][>] This costs :rb_energy_2: less. _(While you have 6+ XP, get the effect.)_",
        expected: ["xp-tracker"],
      },
      {
        name: "derives XP Tracker from spending XP",
        text: "Spend 3 XP: Give your units here [Ganking] this turn.",
        expected: ["xp-tracker"],
      },
      {
        name: "does not derive XP Tracker from a lowercase 'xp'",
        text: "The xp of a long journey.",
        expected: [],
      },
      {
        name: "combines an implicit token with a phrase-matched one",
        text: "Buff a friendly unit, then play a Gold gear token.",
        expected: ["buff", "gold"],
      },
    ])("$name", ({ text, expected }) => {
      expect(find(text)).toEqual(expected);
    });

    it("skips a rule whose token card is absent from the catalog", () => {
      const tokens = [{ cardId: "gold", name: "Gold" }];
      expect(findTokenReferences(["Buff a friendly unit."], tokens, CARD_TYPES, OWNER)).toEqual([]);
    });
  });

  describe("the owning card", () => {
    it.each([
      {
        name: "drops the Buff token's own reminder line",
        text: "A unit may have no more than one buff at a time.",
        owner: "buff",
        expected: [],
      },
      {
        name: "drops the XP Tracker's own rules text",
        text: "Track gained XP here.\nSome cards get bonuses based on your [Level].",
        owner: "xp-tracker",
        expected: [],
      },
      {
        name: "drops a self-reference written with the usual anchor",
        text: "Play another Sand Soldier unit token.",
        owner: "sand-soldier",
        expected: [],
      },
      {
        name: "keeps the other tokens the owning card references",
        text: "A unit may have no more than one buff at a time. Play a Gold gear token.",
        owner: "buff",
        expected: ["gold"],
      },
    ])("$name", ({ text, owner, expected }) => {
      expect(findTokenReferences([text], TOKENS, CARD_TYPES, owner)).toEqual(expected);
    });
  });

  describe("names that are also ordinary words", () => {
    it.each([
      {
        name: "ignores Bird as a tag in a list",
        text: "As you play me, choose Bird, Cat, Dog, or Poro. I gain that tag.",
      },
      { name: "ignores 'token' with no name in front of it", text: "Kill a token you control." },
      { name: "does not match a name embedded in a longer word", text: "Goldsmith token" },
      {
        name: "requires a real card type between the name and 'token'",
        text: "Gold from the token pile",
      },
    ])("$name", ({ text }) => {
      expect(find(text)).toEqual([]);
    });
  });

  describe("multiple sources", () => {
    it.each([
      {
        name: "collects distinct tokens across one text",
        texts: ["Play a Recruit unit token and a Gold gear token."],
        expected: ["gold", "recruit"],
      },
      {
        name: "dedupes the same token across several texts",
        texts: ["Play a Sprite unit token.", "Play another Sprite unit token."],
        expected: ["sprite"],
      },
      {
        name: "unions errata text with printing text",
        texts: ["Play a Mech unit token.", null, "Play a Bird unit token."],
        expected: ["bird", "mech"],
      },
      {
        name: "returns ids in the token-list order, not the text order",
        texts: ["Play a Sprite unit token, then a Bird unit token."],
        expected: ["bird", "sprite"],
      },
    ])("$name", ({ texts, expected }) => {
      expect(find(...texts)).toEqual(expected);
    });
  });

  describe("normalization", () => {
    it.each([
      {
        name: "matches across a line break",
        text: "Play a Sand Soldier unit\ntoken.",
        expected: ["sand-soldier"],
      },
      {
        name: "matches across an interleaved glyph",
        text: "Play a Gold :rb_energy_1: gear token.",
        expected: ["gold"],
      },
      { name: "is case-insensitive", text: "play a RECRUIT UNIT TOKEN", expected: ["recruit"] },
    ])("$name", ({ text, expected }) => {
      expect(find(text)).toEqual(expected);
    });
  });

  describe("edge cases", () => {
    it("returns nothing when every text is empty", () => {
      expect(find(null, undefined, "")).toEqual([]);
    });

    it("returns nothing when there are no token cards", () => {
      expect(findTokenReferences(["Play a Gold gear token."], [], CARD_TYPES, OWNER)).toEqual([]);
    });

    it("still matches the bare form when no card types are supplied", () => {
      expect(findTokenReferences(["Play a Recruit token."], TOKENS, [], OWNER)).toEqual([
        "recruit",
      ]);
    });

    it("treats regex metacharacters in a name as literal", () => {
      const tokens = [{ cardId: "odd", name: "A.B" }];
      expect(findTokenReferences(["Play an AxB unit token."], tokens, CARD_TYPES, OWNER)).toEqual(
        [],
      );
      expect(findTokenReferences(["Play an A.B unit token."], tokens, CARD_TYPES, OWNER)).toEqual([
        "odd",
      ]);
    });

    it("prefers the longer name when one is a prefix of another", () => {
      const tokens = [
        { cardId: "bird", name: "Bird" },
        { cardId: "bird-of-prey", name: "Bird of Prey" },
      ];
      expect(
        findTokenReferences(["Play a Bird of Prey unit token."], tokens, CARD_TYPES, OWNER),
      ).toEqual(["bird-of-prey"]);
    });
  });
});
