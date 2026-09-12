import { listRulesSchema } from "@openrift/shared/types/list-rule";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";
import { describe, expect, it } from "vitest";

import { serializeRules } from "@/features/rules/lib/rule-draft";

import {
  organizeCardRulePresets,
  organizeCopyRulePresets,
  rulePresetsFor,
  tradeRulePresets,
  wishRulePresets,
} from "./rule-presets";

const WISH_RULE_PRESETS = wishRulePresets();
const TRADE_RULE_PRESETS = tradeRulePresets();
const ORGANIZE_CARD_RULE_PRESETS = organizeCardRulePresets();
const ORGANIZE_COPY_RULE_PRESETS = organizeCopyRulePresets();

const ALL_PRESETS = [
  ...WISH_RULE_PRESETS,
  ...TRADE_RULE_PRESETS,
  ...ORGANIZE_CARD_RULE_PRESETS,
  ...ORGANIZE_COPY_RULE_PRESETS,
];

const presetIds = (presets: { id: string }[]) => presets.map((preset) => preset.id);

describe("rule presets", () => {
  it("has unique ids across every intent", () => {
    const ids = ALL_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every card/printing preset serializes to valid demand rules", () => {
    for (const preset of [...WISH_RULE_PRESETS, ...ORGANIZE_CARD_RULE_PRESETS]) {
      const rules = serializeRules(preset.build(), "card");
      expect(rules.length).toBeGreaterThan(0);
      expect(() => listRulesSchema.parse(rules)).not.toThrow();
      expect(rules.every((rule) => rule.kind === "wish")).toBe(true);
    }
  });

  it("every copy preset serializes to valid supply rules", () => {
    for (const preset of [...TRADE_RULE_PRESETS, ...ORGANIZE_COPY_RULE_PRESETS]) {
      const rules = serializeRules(preset.build(), "copy");
      expect(rules.length).toBeGreaterThan(0);
      expect(() => listRulesSchema.parse(rules)).not.toThrow();
      expect(rules.every((rule) => rule.kind === "trade")).toBe(true);
    }
  });

  it("rulePresetsFor picks the set matching the list's intent and kind", () => {
    expect(presetIds(rulePresetsFor("wish", "card"))).toEqual(presetIds(WISH_RULE_PRESETS));
    expect(presetIds(rulePresetsFor("wish", "printing"))).toEqual(presetIds(WISH_RULE_PRESETS));
    expect(presetIds(rulePresetsFor("trade", "copy"))).toEqual(presetIds(TRADE_RULE_PRESETS));
    expect(presetIds(rulePresetsFor("organize", "card"))).toEqual(
      presetIds(ORGANIZE_CARD_RULE_PRESETS),
    );
    expect(presetIds(rulePresetsFor("organize", "printing"))).toEqual(
      presetIds(ORGANIZE_CARD_RULE_PRESETS),
    );
    expect(presetIds(rulePresetsFor("organize", "copy"))).toEqual(
      presetIds(ORGANIZE_COPY_RULE_PRESETS),
    );
  });

  it("organize presets default to including everything that matches", () => {
    const everything = ORGANIZE_CARD_RULE_PRESETS.find(
      (preset) => preset.id === "organize-everything",
    );
    expect(everything?.build()[0]).toMatchObject({
      quantity: { mode: "fixed", n: 1 },
      netOwned: false,
    });

    const allCopies = ORGANIZE_COPY_RULE_PRESETS.find(
      (preset) => preset.id === "organize-all-copies",
    );
    expect(allCopies?.build()[0]).toMatchObject({
      keepPerCard: { mode: "fixed", n: 0 },
      keepPer: "card",
    });
  });

  it("seeds the language facet from the context languages, like a blank rule", () => {
    for (const preset of ALL_PRESETS) {
      const [draft] = preset.build({ languages: ["DE", "EN"] });
      expect(draft?.filter.languages).toEqual(["DE", "EN"]);
      const [blank] = preset.build();
      expect(blank?.filter.languages).toEqual([]);
    }
  });

  it("catalog-wide presets leave every other facet blank", () => {
    for (const preset of ALL_PRESETS) {
      if (preset.id === "main-set-playsets") {
        continue;
      }
      const [blank] = preset.build();
      expect(blank?.filter).toEqual(EMPTY_CARD_FILTERS);
    }
  });

  it("main-set playsets scope to the given main sets, count special versions, and fall back to empty sets without catalog context", () => {
    const preset = WISH_RULE_PRESETS.find((entry) => entry.id === "main-set-playsets");
    const [draft] = preset?.build({ mainSetSlugs: ["origins", "spirit-blossom"] }) ?? [];
    expect(draft).toMatchObject({
      quantity: { mode: "playset", multiplier: 1 },
      netOwned: true,
      countSpecialVersions: true,
    });
    expect(draft?.filter).toEqual({
      ...EMPTY_CARD_FILTERS,
      sets: ["origins", "spirit-blossom"],
      isStandard: true,
      isOvernumbered: false,
      typesExclude: ["rune"],
      superTypesExclude: ["token"],
    });
    const [bare] = preset?.build() ?? [];
    expect(bare?.filter.sets).toEqual([]);
  });

  it("wish presets want only the shortfall (net owned)", () => {
    const one = WISH_RULE_PRESETS.find((preset) => preset.id === "one-of-everything");
    expect(one?.build()[0]).toMatchObject({ quantity: { mode: "fixed", n: 1 }, netOwned: true });

    const playset = WISH_RULE_PRESETS.find((preset) => preset.id === "playset-of-everything");
    expect(playset?.build()[0]).toMatchObject({
      quantity: { mode: "playset", multiplier: 1 },
      netOwned: true,
    });
  });

  it("trade presets keep the advertised counts", () => {
    const keepPlayset = TRADE_RULE_PRESETS.find((preset) => preset.id === "keep-playset");
    expect(keepPlayset?.build()[0]).toMatchObject({
      keepPerCard: { mode: "playset", multiplier: 1 },
      keepPer: "card",
    });

    const onePerCard = TRADE_RULE_PRESETS.find((preset) => preset.id === "keep-one-per-card");
    expect(onePerCard?.build()[0]).toMatchObject({
      keepPerCard: { mode: "fixed", n: 1 },
      keepPer: "card",
    });

    const onePerPrinting = TRADE_RULE_PRESETS.find(
      (preset) => preset.id === "keep-one-per-printing",
    );
    expect(onePerPrinting?.build()[0]).toMatchObject({
      keepPerCard: { mode: "fixed", n: 1 },
      keepPer: "printing",
    });
  });

  it("builds fresh drafts on every call (no shared references)", () => {
    for (const preset of ALL_PRESETS) {
      const first = preset.build();
      const second = preset.build();
      expect(first).toEqual(second);
      expect(first[0]).not.toBe(second[0]);
      expect(first[0]?.excludeIds).not.toBe(second[0]?.excludeIds);
    }
  });
});
