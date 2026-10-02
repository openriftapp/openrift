import { describe, expect, it } from "vitest";

import {
  buildTermAnchors,
  buildTranslatedTermAnchors,
  compareRuleNumbers,
  formatRuleNumber,
  isRuleLanguage,
  RULE_REFERENCE_REGEX,
  ruleNumberDepth,
  ruleReferenceFromMatch,
  sortRuleLanguages,
} from "./rules.js";

describe("ruleNumberDepth", () => {
  it("counts the segments after the top-level number", () => {
    expect(ruleNumberDepth("103")).toBe(0);
    expect(ruleNumberDepth("103.1")).toBe(1);
    expect(ruleNumberDepth("103.1.b")).toBe(2);
    expect(ruleNumberDepth("103.1.b.1")).toBe(3);
  });

  it("caps at three levels", () => {
    expect(ruleNumberDepth("103.1.b.1.x")).toBe(3);
  });
});

function makeRule(overrides: {
  ruleNumber: string;
  content: string;
  ruleType: "title" | "subtitle" | "text";
  depth?: number;
}) {
  return {
    ruleNumber: overrides.ruleNumber,
    content: overrides.content,
    ruleType: overrides.ruleType,
    depth: overrides.depth ?? 0,
  };
}

describe("compareRuleNumbers", () => {
  it("sorts plain integers numerically, not lexicographically", () => {
    const input = ["1000", "100", "200", "30"];
    expect(input.toSorted(compareRuleNumbers)).toEqual(["30", "100", "200", "1000"]);
  });

  it("sorts mixed-version cross-section in natural rule order (regression for 300 before 184.5)", () => {
    const input = ["300", "184.5", "184.6", "187.1", "185"];
    expect(input.toSorted(compareRuleNumbers)).toEqual(["184.5", "184.6", "185", "187.1", "300"]);
  });

  it("orders deeper segments after their parent", () => {
    const input = ["100.1.a", "100", "100.1", "200"];
    expect(input.toSorted(compareRuleNumbers)).toEqual(["100", "100.1", "100.1.a", "200"]);
  });

  it("places numeric segments before letter segments at the same depth", () => {
    const input = ["100.a", "100.1", "100.b", "100.2"];
    expect(input.toSorted(compareRuleNumbers)).toEqual(["100.1", "100.2", "100.a", "100.b"]);
  });

  it("returns 0 for identical inputs", () => {
    expect(compareRuleNumbers("184.5.a", "184.5.a")).toBe(0);
  });
});

describe("formatRuleNumber", () => {
  it("strips a trailing dot", () => {
    expect(formatRuleNumber("103.")).toBe("103");
  });

  it("leaves inner dots untouched", () => {
    expect(formatRuleNumber("103.1.a")).toBe("103.1.a");
  });
});

describe("buildTermAnchors", () => {
  it("indexes subtitles and adds singular/plural variants", () => {
    const anchors = buildTermAnchors([
      makeRule({ ruleNumber: "168", ruleType: "subtitle", content: "Battlefields" }),
      makeRule({ ruleNumber: "454", ruleType: "subtitle", content: "Combat" }),
    ]);
    expect(anchors.get("battlefields")).toBe("168");
    expect(anchors.get("battlefield")).toBe("168");
    expect(anchors.get("combat")).toBe("454");
    expect(anchors.get("combats")).toBe("454");
  });

  it("indexes text rules whose body is exactly *Term*", () => {
    const anchors = buildTermAnchors([
      makeRule({ ruleNumber: "423", ruleType: "text", content: "*Stun*" }),
      makeRule({ ruleNumber: "805", ruleType: "text", content: "*Accelerate*" }),
    ]);
    expect(anchors.get("stun")).toBe("423");
    expect(anchors.get("accelerate")).toBe("805");
  });

  it("lets later text-rule definitions override earlier ones", () => {
    const anchors = buildTermAnchors([
      makeRule({ ruleNumber: "158.2.a", ruleType: "text", content: "*Action*" }),
      makeRule({ ruleNumber: "806", ruleType: "text", content: "*Action*" }),
    ]);
    expect(anchors.get("action")).toBe("806");
  });

  it("lets subtitles override text-rule entries", () => {
    const anchors = buildTermAnchors([
      makeRule({ ruleNumber: "133.4.b", ruleType: "text", content: "*Spells*" }),
      makeRule({ ruleNumber: "152", ruleType: "subtitle", content: "Spells" }),
    ]);
    expect(anchors.get("spells")).toBe("152");
    expect(anchors.get("spell")).toBe("152");
  });

  it("indexes multi-word italicized terms", () => {
    const anchors = buildTermAnchors([
      makeRule({ ruleNumber: "107.2", ruleType: "text", content: "*Battlefield Zone*" }),
      makeRule({ ruleNumber: "136", ruleType: "text", content: "*Effect Text*" }),
    ]);
    expect(anchors.get("battlefield zone")).toBe("107.2");
    expect(anchors.get("effect text")).toBe("136");
  });

  it("indexes depth-0 plain-text headings (no italics)", () => {
    const anchors = buildTermAnchors([
      makeRule({ ruleNumber: "363", ruleType: "text", depth: 0, content: "Passive Abilities" }),
      makeRule({ ruleNumber: "367", ruleType: "text", depth: 0, content: "Replacement Effects" }),
    ]);
    expect(anchors.get("passive abilities")).toBe("363");
    expect(anchors.get("passive ability")).toBe("363");
    expect(anchors.get("replacement effects")).toBe("367");
    expect(anchors.get("replacement effect")).toBe("367");
  });

  it("ignores depth-0 prose that happens to start with a capital letter", () => {
    const anchors = buildTermAnchors([
      makeRule({
        ruleNumber: "109",
        ruleType: "text",
        depth: 0,
        content: "All *Game Objects* in the collective *Play Areas* are *Public Information.*",
      }),
    ]);
    expect(anchors.has("all")).toBe(false);
  });

  it("does not index depth>0 plain-text rules as headings", () => {
    const anchors = buildTermAnchors([
      makeRule({
        ruleNumber: "200.1",
        ruleType: "text",
        depth: 1,
        content: "Passive Abilities",
      }),
    ]);
    expect(anchors.has("passive abilities")).toBe(false);
  });

  it("pairs -y/-ies forms (Ability ↔ Abilities)", () => {
    const fromPlural = buildTermAnchors([
      makeRule({ ruleNumber: "360", ruleType: "subtitle", content: "Abilities" }),
    ]);
    expect(fromPlural.get("abilities")).toBe("360");
    expect(fromPlural.get("ability")).toBe("360");

    const fromSingular = buildTermAnchors([
      makeRule({ ruleNumber: "360", ruleType: "subtitle", content: "Ability" }),
    ]);
    expect(fromSingular.get("ability")).toBe("360");
    expect(fromSingular.get("abilities")).toBe("360");
  });

  it("splits compound subtitles on `and`", () => {
    const anchors = buildTermAnchors([
      makeRule({
        ruleNumber: "325",
        ruleType: "subtitle",
        content: "Chains and Showdowns",
      }),
    ]);
    expect(anchors.get("chains")).toBe("325");
    expect(anchors.get("chain")).toBe("325");
    expect(anchors.get("showdowns")).toBe("325");
    expect(anchors.get("showdown")).toBe("325");
  });
});

describe("ruleReferenceFromMatch", () => {
  const references = (text: string) =>
    [...text.matchAll(new RegExp(RULE_REFERENCE_REGEX.source, "gu"))].map((match) =>
      ruleReferenceFromMatch(match.groups),
    );

  it("reads English, French and Korean references", () => {
    expect(references("See rule 540.4.b. and CR 116")).toEqual([
      { ruleNumber: "540.4.b", inCoreRules: false },
      { ruleNumber: "116", inCoreRules: true },
    ]);
    expect(references("Voir règles 197 et 603.7")).toEqual([
      { ruleNumber: "197", inCoreRules: false },
      { ruleNumber: "603.7", inCoreRules: false },
    ]);
    expect(references("규칙 제349조, 핵심 규칙 제128조, 제355.6조")).toEqual([
      { ruleNumber: "349", inCoreRules: false },
      { ruleNumber: "128", inCoreRules: true },
      { ruleNumber: "355.6", inCoreRules: false },
    ]);
  });
});

describe("rule languages", () => {
  it("accepts only languages with rules documents", () => {
    expect(isRuleLanguage("ko")).toBe(true);
    expect(isRuleLanguage("de")).toBe(false);
    expect(isRuleLanguage(undefined)).toBe(false);
  });

  it("sorts languages English first and drops duplicates", () => {
    expect(sortRuleLanguages(["ko", "en", "fr", "ko"])).toEqual(["en", "fr", "ko"]);
  });
});

describe("buildTranslatedTermAnchors", () => {
  const english = new Map([
    ["the board", "107"],
    ["board", "107"],
    ["priority", "311"],
    ["focus", "311"],
    ["triggered abilities", "382"],
  ]);
  const french = [
    { ruleNumber: "107", content: "*Le plateau*" },
    { ruleNumber: "311", content: "Priorité et focalisation" },
    { ruleNumber: "382", content: "Compétences déclenchées" },
  ];

  it("names French terms by the rule numbers of the English ones", () => {
    const anchors = buildTranslatedTermAnchors(english, french, "fr");
    expect(anchors.get("plateau")).toBe("107");
    expect(anchors.get("priorité")).toBe("311");
    expect(anchors.get("focalisation")).toBe("311");
  });

  it("adds singular and plural forms of every word", () => {
    const anchors = buildTranslatedTermAnchors(english, french, "fr");
    expect(anchors.get("compétences déclenchées")).toBe("382");
    expect(anchors.get("compétence déclenchée")).toBe("382");
    expect(anchors.get("plateaus")).toBe("107");
  });

  it("skips a rule whose text is more than a heading", () => {
    const anchors = buildTranslatedTermAnchors(
      new Map([["chain", "108.1"]]),
      [{ ruleNumber: "108.1", content: "Chaîne\nLa chaîne est une zone." }],
      "fr",
    );
    expect(anchors.size).toBe(0);
  });

  it("builds nothing for Korean, which sets no emphasis to link", () => {
    expect(
      buildTranslatedTermAnchors(english, [{ ruleNumber: "107", content: "보드" }], "ko").size,
    ).toBe(0);
  });
});
