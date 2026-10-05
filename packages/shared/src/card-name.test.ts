import { describe, expect, it } from "vitest";

import {
  cardSearchAltNames,
  compareCardDisplayName,
  deckIdentityLabels,
  legendDisplayName,
  legendNameParts,
  normalizeNameForIdentity,
} from "./card-name.js";
import type { CardType } from "./types/enums.js";

describe("legendDisplayName", () => {
  it("prepends the champion tag for a Legend", () => {
    expect(
      legendDisplayName({ name: "Emperor of the Sands", types: ["legend"], tags: ["Azir"] }),
    ).toBe("Azir, Emperor of the Sands");
  });

  it("returns the bare name for a Legend with no tags", () => {
    expect(legendDisplayName({ name: "Nameless Legend", types: ["legend"], tags: [] })).toBe(
      "Nameless Legend",
    );
  });

  it("uses the first tag when a Legend has several", () => {
    expect(
      legendDisplayName({ name: "Twin Souls", types: ["legend"], tags: ["Kindred", "Lamb"] }),
    ).toBe("Kindred, Twin Souls");
  });

  it("leaves a name that already leads with the champion alone", () => {
    expect(legendDisplayName({ name: "Sett, Kingpin", types: ["legend"], tags: ["Sett"] })).toBe(
      "Sett, Kingpin",
    );
  });

  it("drops a print-run qualifier after the epithet", () => {
    expect(
      legendDisplayName({ name: "Dark Child, Starter", types: ["legend"], tags: ["Annie"] }),
    ).toBe("Annie, Dark Child");
  });

  it("keeps a comma in a non-Legend name, where it separates champion and epithet", () => {
    expect(legendDisplayName({ name: "Garen, Crownguard", types: ["unit"], tags: ["Garen"] })).toBe(
      "Garen, Crownguard",
    );
  });

  it("returns the bare name for non-Legend cards even when tagged", () => {
    expect(legendDisplayName({ name: "Recall", types: ["spell"], tags: ["Azir"] })).toBe("Recall");
  });
});

describe("compareCardDisplayName", () => {
  const azir = { name: "Emperor of the Sands", types: ["legend" as CardType], tags: ["Azir"] };
  const bolt = { name: "Bolt", types: ["spell" as CardType], tags: [] };

  it("files a Legend under its champion, not its epithet", () => {
    expect(compareCardDisplayName(azir, bolt)).toBeLessThan(0);
    expect(compareCardDisplayName(bolt, azir)).toBeGreaterThan(0);
  });

  it("sorts a list the way the labels read", () => {
    const zed = { name: "Master of Shadows", types: ["legend" as CardType], tags: ["Zed"] };
    expect([zed, azir, bolt].toSorted(compareCardDisplayName).map((card) => card.name)).toEqual([
      "Emperor of the Sands",
      "Bolt",
      "Master of Shadows",
    ]);
  });
});

describe("cardSearchAltNames", () => {
  const azir = { name: "Emperor of the Sands", types: ["legend" as CardType], tags: ["Azir"] };
  const recall = { name: "Recall", types: ["spell" as CardType], tags: ["Azir"] };

  it("offers a Legend's colloquial champion form", () => {
    expect(cardSearchAltNames(azir)).toEqual(["Azir, Emperor of the Sands"]);
  });

  it("never repeats the canonical name", () => {
    expect(cardSearchAltNames(recall)).toEqual([]);
    expect(cardSearchAltNames(azir, ["Emperor of the Sands"])).toEqual([
      "Azir, Emperor of the Sands",
    ]);
  });

  it("appends the caller's extra names", () => {
    expect(cardSearchAltNames(azir, ["沙漠皇帝", "azirdesertemperor"])).toEqual([
      "Azir, Emperor of the Sands",
      "沙漠皇帝",
      "azirdesertemperor",
    ]);
  });

  it("drops nullish and duplicate extras", () => {
    expect(
      cardSearchAltNames(recall, [null, undefined, "", "Recall Spell", "Recall Spell"]),
    ).toEqual(["Recall Spell"]);
  });
});

describe("deckIdentityLabels", () => {
  const melLegend = { name: "Soul’s Reflection", types: ["legend" as CardType], tags: ["Mel"] };

  it("factors out the champion both cards name", () => {
    expect(deckIdentityLabels(melLegend, { name: "Mel, Newly Awakened" })).toEqual({
      character: "Mel",
      legend: "Soul’s Reflection",
      champion: "Newly Awakened",
    });
  });

  it("keeps full names when the pair names different champions", () => {
    expect(deckIdentityLabels(melLegend, { name: "Viktor, Innovator" })).toEqual({
      legend: "Mel, Soul’s Reflection",
      champion: "Viktor, Innovator",
    });
  });

  it("keeps the full name when the champion unit is the bare champion", () => {
    expect(deckIdentityLabels(melLegend, { name: "Mel" })).toEqual({
      legend: "Mel, Soul’s Reflection",
      champion: "Mel",
    });
  });

  it("splits the champion on the tag, not the first comma, and drops the Legend's qualifier", () => {
    expect(
      deckIdentityLabels(
        { name: "Dark Child, Starter", types: ["legend"], tags: ["Annie"] },
        { name: "Annie, Child of Fire" },
      ),
    ).toEqual({
      character: "Annie",
      legend: "Dark Child",
      champion: "Child of Fire",
    });
  });

  it("leaves a tagless Legend alone", () => {
    expect(
      deckIdentityLabels({ name: "Nameless Legend", types: ["legend"], tags: [] }, { name: "Mel" }),
    ).toEqual({ legend: "Nameless Legend", champion: "Mel" });
  });

  it("handles a half-built deck with only one side", () => {
    expect(deckIdentityLabels(melLegend, undefined)).toEqual({
      legend: "Mel, Soul’s Reflection",
      champion: undefined,
    });
    expect(deckIdentityLabels(undefined, { name: "Mel, Newly Awakened" })).toEqual({
      legend: undefined,
      champion: "Mel, Newly Awakened",
    });
  });
});

describe("normalizeNameForIdentity", () => {
  it("lowercases and strips non-alphanumeric characters", () => {
    expect(normalizeNameForIdentity("Kai'Sa, Survivor")).toBe("kaisasurvivor");
  });

  it("removes hyphens", () => {
    expect(normalizeNameForIdentity("Mega-Mech")).toBe("megamech");
  });

  it("removes spaces", () => {
    expect(normalizeNameForIdentity("KaiSa Survivor")).toBe("kaisasurvivor");
  });

  it("returns empty string for all-special-character input", () => {
    expect(normalizeNameForIdentity("!@#$%^&*()")).toBe("");
  });

  it("handles already-clean lowercase input", () => {
    expect(normalizeNameForIdentity("fireball")).toBe("fireball");
  });

  it("handles mixed case with numbers", () => {
    expect(normalizeNameForIdentity("Unit-42X")).toBe("unit42x");
  });

  describe("non-Latin scripts", () => {
    it("keeps a CJK name instead of emptying it", () => {
      expect(normalizeNameForIdentity("影流之主")).toBe("影流之主");
    });

    it("keeps Japanese kana and drops the ideographic comma", () => {
      expect(normalizeNameForIdentity("ゼド、影の主")).toBe("ゼド影の主");
    });

    it("keeps Korean hangul", () => {
      expect(normalizeNameForIdentity("한글 카드")).toBe("한글카드");
    });

    it("keeps Cyrillic", () => {
      expect(normalizeNameForIdentity("Владыка Теней")).toBe("владыкатеней");
    });

    it("keeps Greek", () => {
      expect(normalizeNameForIdentity("Άρχοντας")).toBe("άρχοντας");
    });

    it("gives distinct keys to distinct non-Latin names", () => {
      const names = ["影流之主", "祖安狂人", "德玛西亚之力", "Владыка Теней", "Άρχοντας"];
      const keys = names.map((n) => normalizeNameForIdentity(n));
      expect(new Set(keys).size).toBe(names.length);
      expect(keys).not.toContain("");
    });

    it("does not fold Cyrillic short-i onto i", () => {
      // NFKD would decompose й to и + breve and merge these two distinct
      // names. Accents are deliberately not folded for exactly this reason.
      expect(normalizeNameForIdentity("Тений")).not.toBe(normalizeNameForIdentity("Тени"));
    });
  });

  describe("mixed script", () => {
    it("keeps both halves of a mixed CJK/Latin name", () => {
      expect(normalizeNameForIdentity("黯荧岛Dark Glow")).toBe("黯荧岛darkglow");
    });

    it("keeps an accented Latin letter rather than deleting it", () => {
      expect(normalizeNameForIdentity("Autel d'unité")).toBe("auteldunité");
    });
  });

  describe("names with no letters or digits", () => {
    it("still returns empty for punctuation-only input", () => {
      expect(normalizeNameForIdentity("!?!")).toBe("");
    });

    it("returns empty for symbol-only input", () => {
      expect(normalizeNameForIdentity("★☆")).toBe("");
      expect(normalizeNameForIdentity("🎴")).toBe("");
    });
  });

  // `\p{N}` would keep these; PostgreSQL's `[[:alnum:]]` drops them. The class
  // is narrowed to `\p{Nd}` + `\p{Nl}` so the TS and SQL keys stay identical.
  describe("Postgres [[:alnum:]] parity", () => {
    it("drops other-number characters", () => {
      expect(normalizeNameForIdentity("½ half")).toBe("half");
      expect(normalizeNameForIdentity("¾ x ² y ① z ⅓")).toBe("xyz");
    });

    it("keeps decimal digits from other scripts", () => {
      expect(normalizeNameForIdentity("٣٤٥ arabic")).toBe("٣٤٥arabic");
    });

    it("keeps letter-number characters", () => {
      expect(normalizeNameForIdentity("Ⅻ roman")).toBe("ⅻroman");
    });

    it("removes the combining mark that lowercasing a dotted I introduces", () => {
      // "İ".toLowerCase() is "i" + U+0307, and the strip has to take the mark
      // off. This is why both sides lowercase *before* stripping.
      expect(normalizeNameForIdentity("İstanbul")).toBe("istanbul");
    });
  });

  it("is idempotent", () => {
    for (const input of ["Kai'Sa, Survivor", "影流之主", "黯荧岛Dark Glow", "Владыка Теней"]) {
      expect(normalizeNameForIdentity(normalizeNameForIdentity(input))).toBe(
        normalizeNameForIdentity(input),
      );
    }
  });
});

describe("legendNameParts", () => {
  it("splits a Legend into its champion tag and epithet", () => {
    expect(
      legendNameParts({ name: "Emperor of the Sands", types: ["legend"], tags: ["Azir"] }),
    ).toEqual({ character: "Azir", epithet: "Emperor of the Sands" });
  });

  it("strips the champion prefix and drops a qualifier", () => {
    expect(legendNameParts({ name: "Sett, Kingpin", types: ["legend"], tags: ["Sett"] })).toEqual({
      character: "Sett",
      epithet: "Kingpin",
    });
    expect(
      legendNameParts({ name: "Dark Child, Starter", types: ["legend"], tags: ["Annie"] }),
    ).toEqual({ character: "Annie", epithet: "Dark Child" });
  });

  it("has no character for non-Legends or tagless Legends", () => {
    expect(
      legendNameParts({ name: "Garen, Crownguard", types: ["unit"], tags: ["Garen"] }),
    ).toEqual({ character: null, epithet: "Garen, Crownguard" });
    expect(legendNameParts({ name: "Nameless", types: ["legend"], tags: [] })).toEqual({
      character: null,
      epithet: "Nameless",
    });
  });
});
