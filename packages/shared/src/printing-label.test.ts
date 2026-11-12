import { describe, expect, it } from "vitest";

import { labelMapOf } from "./enum-label.js";
import type { VariantLabelEnumLabels, VariantLabelPrinting } from "./printing-label.js";
import {
  formatPrintingLabel,
  printingVariantPartsEnglish,
  formatPrintingVariantLabelParts,
  printingLabelParts,
  summarizeVariantSiblings,
} from "./printing-label.js";

const FINISHES = { normal: "Normal", foil: "Foil" };

const TEST_LABELS: VariantLabelEnumLabels = {
  finishes: labelMapOf(FINISHES),
  artVariants: labelMapOf({
    normal: "Normal",
    altart: "Alt Art",
    overnumbered: "Overnumbered",
    ultimate: "Ultimate",
  }),
  cardSizes: labelMapOf({ standard: "Standard", oversized: "Oversized" }),
};

function formatPrintingVariantLabel(
  printing: VariantLabelPrinting,
  siblings: Parameters<typeof printingVariantPartsEnglish>[1],
  labels: Parameters<typeof printingVariantPartsEnglish>[2],
): string {
  return printingVariantPartsEnglish(printing, siblings, labels).join(" · ") || "Standard";
}

const ENGLISH_LABELS = {
  ...TEST_LABELS,
  languages: labelMapOf({ EN: "English", SC: "Simplified Chinese" }),
};

function stub(overrides: Partial<VariantLabelPrinting> = {}): VariantLabelPrinting {
  return {
    language: "EN",
    artVariant: "normal",
    finish: "normal",
    size: "standard",
    isSigned: false,
    isOvernumbered: false,
    markers: [],
    ...overrides,
  };
}

describe("formatPrintingVariantLabel", () => {
  it('returns "Standard" when nothing distinguishes the printing', () => {
    expect(formatPrintingVariantLabel(stub(), undefined, ENGLISH_LABELS)).toBe("Standard");
  });

  it("shows non-normal attributes when no siblings provided", () => {
    const p = stub({
      artVariant: "altart",
      finish: "foil",
      isSigned: true,
      markers: [{ slug: "promo", label: "Promo" }],
    });
    expect(formatPrintingVariantLabel(p, undefined, ENGLISH_LABELS)).toBe(
      "Alt Art · Promo · Foil · Signed",
    );
  });

  it("uses the label map for custom finish slugs", () => {
    const labels: VariantLabelEnumLabels = {
      ...TEST_LABELS,
      finishes: labelMapOf({ ...FINISHES, metal: "Metal" }),
    };
    expect(
      formatPrintingVariantLabel(stub({ finish: "metal" }), undefined, {
        ...ENGLISH_LABELS,
        ...labels,
      }),
    ).toBe("Metal");
  });

  it("labels an overnumbered printing even without an in-total sibling", () => {
    expect(
      formatPrintingVariantLabel(stub({ isOvernumbered: true }), undefined, ENGLISH_LABELS),
    ).toBe("Overnumbered");
  });

  it("labels alt art and overnumbered together", () => {
    const p = stub({ artVariant: "altart", isOvernumbered: true });
    expect(formatPrintingVariantLabel(p, undefined, ENGLISH_LABELS)).toBe("Alt Art · Overnumbered");
  });

  it("labels an oversized printing even without a standard sibling", () => {
    expect(formatPrintingVariantLabel(stub({ size: "oversized" }), undefined, ENGLISH_LABELS)).toBe(
      "Oversized",
    );
  });

  it("distinguishes an oversized printing from its identical-art standard twin", () => {
    const standard = stub({ size: "standard" });
    const oversized = stub({ size: "oversized" });
    const siblings = [standard, oversized];
    expect(formatPrintingVariantLabel(standard, siblings, ENGLISH_LABELS)).toBe("Standard");
    expect(formatPrintingVariantLabel(oversized, siblings, ENGLISH_LABELS)).toBe("Oversized");
  });

  it("combines size with other distinguishing attributes", () => {
    const oversizedFoil = stub({ size: "oversized", finish: "foil" });
    const siblings = [stub({ finish: "normal" }), oversizedFoil];
    expect(formatPrintingVariantLabel(oversizedFoil, siblings, ENGLISH_LABELS)).toBe(
      "Foil · Oversized",
    );
  });

  it("distinguishes a foil printing from its standard sibling", () => {
    const standard = stub({ finish: "normal" });
    const foil = stub({ finish: "foil" });
    const siblings = [standard, foil];
    expect(formatPrintingVariantLabel(standard, siblings, ENGLISH_LABELS)).toBe("Standard");
    expect(formatPrintingVariantLabel(foil, siblings, ENGLISH_LABELS)).toBe("Foil");
  });

  it("omits attributes shared by all siblings", () => {
    const base = { finish: "foil" };
    const p = stub({ ...base, artVariant: "altart" });
    const siblings = [p, stub({ ...base, artVariant: "normal" })];
    expect(formatPrintingVariantLabel(p, siblings, ENGLISH_LABELS)).toBe("Alt Art");
  });

  it("includes attributes that differ among siblings", () => {
    const markers = [{ slug: "promo", label: "Promo" }];
    const p = stub({ isSigned: true, markers });
    const siblings = [p, stub({ isSigned: false, markers })];
    expect(formatPrintingVariantLabel(p, siblings, ENGLISH_LABELS)).toBe("Signed");
  });

  it("joins multiple distinguishing attributes with ·", () => {
    const p = stub({ artVariant: "altart", isSigned: true });
    const siblings = [p, stub()];
    expect(formatPrintingVariantLabel(p, siblings, ENGLISH_LABELS)).toBe("Alt Art · Signed");
  });

  it("names the language on every row when it varies, including English", () => {
    const en = stub({ language: "EN" });
    const sc = stub({ language: "SC" });
    const siblings = [en, sc];
    expect(formatPrintingVariantLabel(en, siblings, ENGLISH_LABELS)).toBe("English");
    expect(formatPrintingVariantLabel(sc, siblings, ENGLISH_LABELS)).toBe("Simplified Chinese");
  });

  it("puts the language before other distinguishing attributes", () => {
    const p = stub({ language: "SC", artVariant: "altart", isSigned: true });
    const siblings = [p, stub({ language: "EN" })];
    expect(formatPrintingVariantLabel(p, siblings, ENGLISH_LABELS)).toBe(
      "Simplified Chinese · Alt Art · Signed",
    );
  });

  it("omits English when every sibling shares it", () => {
    const p = stub({ language: "EN", artVariant: "altart" });
    const siblings = [p, stub({ language: "EN" })];
    expect(formatPrintingVariantLabel(p, siblings, ENGLISH_LABELS)).toBe("Alt Art");
  });

  it("names a non-English language even when every sibling shares it", () => {
    const p = stub({ language: "SC" });
    expect(formatPrintingVariantLabel(p, undefined, ENGLISH_LABELS)).toBe("Simplified Chinese");
    expect(formatPrintingVariantLabel(p, [p, stub({ language: "SC" })], ENGLISH_LABELS)).toBe(
      "Simplified Chinese",
    );
  });

  it("falls back to the language code without a label row", () => {
    expect(formatPrintingVariantLabel(stub({ language: "KO" }), undefined, ENGLISH_LABELS)).toBe(
      "KO",
    );
  });

  it("labels a non-normal art variant even when it is the only sibling", () => {
    const p = stub({ artVariant: "altart" });
    expect(formatPrintingVariantLabel(p, [p], ENGLISH_LABELS)).toBe("Alt Art");
  });

  it("labels a non-normal art variant when every sibling shares it", () => {
    const p = stub({ artVariant: "altart" });
    const siblings = [p, stub({ artVariant: "altart", isSigned: true })];
    expect(formatPrintingVariantLabel(p, siblings, ENGLISH_LABELS)).toBe("Alt Art");
  });
});

describe("formatPrintingVariantLabelParts", () => {
  it("returns no language and no rest for a standard printing without siblings", () => {
    expect(formatPrintingVariantLabelParts(stub(), undefined, TEST_LABELS)).toEqual({
      language: null,
      rest: [],
      otherSide: null,
      otherSideIsSelf: false,
    });
  });

  it("surfaces the language code (not a [XX] tag) when siblings differ", () => {
    const en = stub({ language: "EN" });
    const sc = stub({ language: "SC" });
    const siblings = [en, sc];
    expect(formatPrintingVariantLabelParts(sc, siblings, TEST_LABELS)).toEqual({
      language: "SC",
      rest: [],
      otherSide: null,
      otherSideIsSelf: false,
    });
    expect(formatPrintingVariantLabelParts(en, siblings, TEST_LABELS)).toEqual({
      language: "EN",
      rest: [],
      otherSide: null,
      otherSideIsSelf: false,
    });
  });

  it("keeps the language separate from the non-language attribute labels", () => {
    const p = stub({ language: "SC", artVariant: "altart", isSigned: true });
    const siblings = [p, stub({ language: "EN" })];
    expect(formatPrintingVariantLabelParts(p, siblings, TEST_LABELS)).toEqual({
      language: "SC",
      rest: ["Alt Art", "Signed"],
      otherSide: null,
      otherSideIsSelf: false,
    });
  });

  it("omits the language when every sibling shares it", () => {
    const p = stub({ language: "EN", artVariant: "altart" });
    const siblings = [p, stub({ language: "EN" })];
    expect(formatPrintingVariantLabelParts(p, siblings, TEST_LABELS)).toEqual({
      language: null,
      rest: ["Alt Art"],
      otherSide: null,
      otherSideIsSelf: false,
    });
  });

  it("names the other side of a double-sided printing", () => {
    const p = stub({ otherSide: { cardName: "Buff", shortCode: "OGN" } });
    expect(formatPrintingVariantLabelParts(p, [p], TEST_LABELS).otherSide).toBe("Buff");
    expect(formatPrintingVariantLabel(p, [p], ENGLISH_LABELS)).toBe("with Buff");
  });

  it("adds the other side's code when a sibling's other side has the same name", () => {
    const first = stub({ otherSide: { cardName: "Recruit", shortCode: "OGN-271" } });
    const second = stub({ otherSide: { cardName: "Recruit", shortCode: "OGN-272" } });
    const sprite = stub({ otherSide: { cardName: "Sprite", shortCode: "OGN-274" } });
    const siblings = [first, second, sprite];
    expect(formatPrintingVariantLabelParts(first, siblings, TEST_LABELS).otherSide).toBe(
      "Recruit (OGN-271)",
    );
    expect(formatPrintingVariantLabelParts(sprite, siblings, TEST_LABELS).otherSide).toBe("Sprite");
  });

  it("omits the other side's code when the same-named other side belongs to a different code", () => {
    const ogn = stub({ shortCode: "OGN", otherSide: { cardName: "Sprite", shortCode: "OGN-274" } });
    const unl = stub({
      shortCode: "UNL-T04",
      otherSide: { cardName: "Sprite", shortCode: "UNL-T07" },
    });
    const siblings = [ogn, unl];
    expect(formatPrintingVariantLabelParts(ogn, siblings, TEST_LABELS).otherSide).toBe("Sprite");
    expect(formatPrintingVariantLabelParts(unl, siblings, TEST_LABELS).otherSide).toBe("Sprite");
  });

  it("flags a printing that shows the same card on both sides", () => {
    const p = stub({
      cardId: "buff",
      otherSide: { cardName: "Buff", shortCode: "OGN", cardId: "buff" },
    });
    const q = stub({
      cardId: "buff",
      otherSide: { cardName: "Recruit", shortCode: "OGN-271", cardId: "recruit" },
    });
    expect(formatPrintingVariantLabelParts(p, [p], TEST_LABELS).otherSideIsSelf).toBe(true);
    expect(formatPrintingVariantLabelParts(q, [q], TEST_LABELS).otherSideIsSelf).toBe(false);
  });

  it("uses the given flag labels", () => {
    const p = stub({ isOvernumbered: true, isSigned: true });
    const labels = { ...TEST_LABELS, flags: { overnumbered: "Surnuméroté", signed: "Signée" } };
    expect(formatPrintingVariantLabelParts(p, undefined, labels).rest).toEqual([
      "Surnuméroté",
      "Signée",
    ]);
  });

  it("marks a part only one side has", () => {
    const p = stub({
      artVariant: "altart",
      finish: "foil",
      cardId: "buff",
      otherSide: { cardName: "Buff", shortCode: "OGN", cardId: "buff", finish: "normal" },
    });
    expect(formatPrintingVariantLabel(p, [p], ENGLISH_LABELS)).toBe(
      "Alt Art · Foil on one side · Buff on both sides",
    );
  });

  it("marks a part only the other side has", () => {
    const p = stub({
      otherSide: { cardName: "Recruit", shortCode: "OGN-271", finish: "foil", isSigned: true },
    });
    expect(formatPrintingVariantLabelParts(p, [p], TEST_LABELS).rest).toEqual([
      "Foil on one side",
      "Signed on one side",
    ]);
  });

  it("shows a part both sides share once, without the mark", () => {
    const p = stub({
      finish: "foil",
      otherSide: { cardName: "Recruit", shortCode: "OGN-271", finish: "foil" },
    });
    expect(formatPrintingVariantLabelParts(p, undefined, TEST_LABELS).rest).toEqual(["Foil"]);
  });

  it("keeps a finish every sibling shares when the sides differ in it", () => {
    const p = stub({
      finish: "foil",
      otherSide: { cardName: "Recruit", shortCode: "OGN-271", finish: "normal" },
    });
    const sibling = stub({ finish: "foil" });
    expect(formatPrintingVariantLabelParts(p, [p, sibling], TEST_LABELS).rest).toEqual([
      "Foil on one side",
    ]);
  });

  it("marks a marker only one side has, before the finish", () => {
    const promo = { slug: "promo", label: "Promo" };
    const p = stub({
      finish: "foil",
      markers: [promo],
      otherSide: { cardName: "Recruit", shortCode: "OGN-271", finish: "normal", markers: [] },
    });
    expect(formatPrintingVariantLabelParts(p, [p], TEST_LABELS).rest).toEqual([
      "Promo on one side",
      "Foil on one side",
    ]);
  });

  it("assumes the other side's markers when it does not list them", () => {
    const p = stub({
      markers: [{ slug: "promo", label: "Promo" }],
      otherSide: { cardName: "Recruit", shortCode: "OGN-271", finish: "normal" },
    });
    expect(formatPrintingVariantLabelParts(p, undefined, TEST_LABELS).rest).toEqual(["Promo"]);
  });

  it("uses the given one-side wording", () => {
    const p = stub({
      finish: "foil",
      otherSide: { cardName: "Recruit", shortCode: "OGN-271", finish: "normal" },
    });
    const labels = { ...TEST_LABELS, onOneSide: (part: string) => `${part} d'un côté` };
    expect(formatPrintingVariantLabelParts(p, undefined, labels).rest).toEqual(["Foil d'un côté"]);
  });

  it("has no other side for a single-sided printing", () => {
    expect(formatPrintingVariantLabelParts(stub(), undefined, TEST_LABELS).otherSide).toBeNull();
  });
});

describe("variant sibling summaries", () => {
  const PROMO = { slug: "promo", label: "Promo" };
  const JUDGE = { slug: "judge", label: "Judge" };
  const JINX = [
    stub({ shortCode: "OGN-001" }),
    stub({ shortCode: "OGN-001", finish: "foil" }),
    stub({ shortCode: "OGN-001", language: "FR" }),
    stub({ shortCode: "OGN-001", language: "ZH", finish: "foil" }),
    stub({ shortCode: "OGN-301", artVariant: "altart", finish: "foil" }),
    stub({ shortCode: "OGN-302", isOvernumbered: true, finish: "foil" }),
    stub({ shortCode: "OGN-302", isOvernumbered: true, finish: "foil", isSigned: true }),
    stub({ shortCode: "OGN-001", markers: [PROMO], finish: "foil" }),
    stub({ shortCode: "OGN-001", markers: [PROMO, JUDGE], finish: "foil" }),
    stub({ shortCode: "OGN-001", size: "oversized" }),
  ];
  const RECRUIT = [
    stub({ shortCode: "OGN-271", otherSide: { cardName: "Recruit", shortCode: "OGN-271" } }),
    stub({ shortCode: "OGN-271", otherSide: { cardName: "Recruit", shortCode: "OGN-272" } }),
    stub({ shortCode: "OGN-271", otherSide: { cardName: "Sprite", shortCode: "OGN-274" } }),
    stub({
      shortCode: "OGN-275",
      cardId: "gold",
      otherSide: { cardName: "Gold", shortCode: "OGN-275", cardId: "gold", finish: "foil" },
    }),
  ];
  const SOLO = [stub({ shortCode: "SFD-010", finish: "foil", isSigned: true, markers: [PROMO] })];

  const EXPECTED: Record<string, string[]> = {
    jinx: [
      "English",
      "English · Foil",
      "FR",
      "ZH · Foil",
      "English · Alt Art · Foil",
      "English · Overnumbered · Foil",
      "English · Overnumbered · Foil · Signed",
      "English · Promo · Foil",
      "English · Promo + Judge · Foil",
      "English · Oversized",
    ],
    recruit: [
      "with Recruit (OGN-271)",
      "with Recruit (OGN-272)",
      "with Sprite",
      "Foil on one side · Gold on both sides",
    ],
    solo: ["Standard"],
  };

  for (const [name, siblings] of [
    ["jinx", JINX],
    ["recruit", RECRUIT],
    ["solo", SOLO],
  ] as const) {
    it(`labels the ${name} fixtures the same from siblings and from their summary`, () => {
      const fromSiblings = siblings.map((p) =>
        formatPrintingVariantLabel(p, siblings, ENGLISH_LABELS),
      );
      expect(fromSiblings).toEqual(EXPECTED[name]);
      const summary = summarizeVariantSiblings(siblings);
      const fromSummary = siblings.map((p) =>
        formatPrintingVariantLabel(p, summary, ENGLISH_LABELS),
      );
      expect(fromSummary).toEqual(EXPECTED[name]);
    });
  }

  it("keeps each distinct value once and the rarities of siblings that carry one", () => {
    const summary = summarizeVariantSiblings([
      { ...stub({ shortCode: "OGN-001" }), rarity: "common" },
      { ...stub({ shortCode: "OGN-001", language: "FR" }), rarity: "common" },
      { ...stub({ shortCode: "OGN-301", markers: [PROMO, JUDGE] }), rarity: "epic" },
      stub({ otherSide: { cardName: "Recruit", shortCode: "OGN-272" } }),
    ]);
    expect(summary).toEqual({
      languages: ["EN", "FR"],
      rarities: ["common", "epic"],
      finishes: ["normal"],
      markerSlugs: [[], ["promo", "judge"]],
      signed: [false],
      otherSides: [{ shortCode: undefined, cardName: "Recruit", otherShortCode: "OGN-272" }],
    });
  });
});

describe("formatPrintingLabel", () => {
  it("builds a basic unmarked slug", () => {
    expect(formatPrintingLabel("OGN-001", [], "normal")).toBe("OGN-001::normal");
  });

  it("includes a single marker slug", () => {
    expect(formatPrintingLabel("OGN-001", ["promo"], "foil")).toBe("OGN-001:promo:foil");
  });

  it("joins multiple marker slugs with +", () => {
    expect(formatPrintingLabel("OGN-001", ["promo", "top-8"], "foil")).toBe(
      "OGN-001:promo+top-8:foil",
    );
  });

  it("preserves finish value", () => {
    expect(formatPrintingLabel("OGN-105", [], "normal")).toBe("OGN-105::normal");
  });

  it("prepends EN language prefix when explicit", () => {
    expect(formatPrintingLabel("OGN-001", [], "normal", "EN")).toBe("EN:OGN-001::normal");
  });

  it("omits language prefix when language is null", () => {
    expect(formatPrintingLabel("OGN-001", [], "normal", null)).toBe("OGN-001::normal");
  });

  it("omits language prefix when language is undefined", () => {
    expect(formatPrintingLabel("OGN-001", [], "normal", undefined)).toBe("OGN-001::normal");
  });

  it("prepends language prefix for non-EN languages", () => {
    expect(formatPrintingLabel("OGN-001", [], "normal", "FR")).toBe("FR:OGN-001::normal");
  });

  it("prepends language prefix with marker", () => {
    expect(formatPrintingLabel("OGN-001", ["promo"], "foil", "SC")).toBe("SC:OGN-001:promo:foil");
  });

  it("appends a non-standard size segment", () => {
    expect(formatPrintingLabel("OGN-279", [], "normal", "EN", "oversized")).toBe(
      "EN:OGN-279::normal:oversized",
    );
  });

  it("omits the size segment for standard printings", () => {
    expect(formatPrintingLabel("OGN-279", [], "normal", "EN", "standard")).toBe(
      "EN:OGN-279::normal",
    );
  });

  it("omits the size segment when size is undefined", () => {
    expect(formatPrintingLabel("OGN-279", [], "normal", "EN")).toBe("EN:OGN-279::normal");
  });
});

describe("printingLabelParts", () => {
  it("lists code, markers and finish in order", () => {
    expect(printingLabelParts("OGN-001", ["a", "b"], "foil")).toEqual(["OGN-001", "a+b", "foil"]);
  });

  it("adds a non-standard size after the finish and the language first", () => {
    expect(printingLabelParts("OGN-001", [], "normal", "FR", "oversized")).toEqual([
      "FR",
      "OGN-001",
      "",
      "normal",
      "oversized",
    ]);
  });

  it("skips a standard size and an empty language", () => {
    expect(printingLabelParts("OGN-001", [], "normal", null, "standard")).toEqual([
      "OGN-001",
      "",
      "normal",
    ]);
  });
});

describe("printingVariantPartsEnglish", () => {
  it("returns no parts for a standard English printing", () => {
    expect(printingVariantPartsEnglish(stub(), undefined, ENGLISH_LABELS)).toEqual([]);
  });

  it("leads with the language label and ends with the other side", () => {
    const p = stub({
      language: "SC",
      finish: "foil",
      otherSide: { cardName: "Buff", shortCode: "OGN" },
    });
    expect(printingVariantPartsEnglish(p, undefined, ENGLISH_LABELS)).toEqual([
      "Simplified Chinese",
      "Foil",
      "with Buff",
    ]);
  });
});
