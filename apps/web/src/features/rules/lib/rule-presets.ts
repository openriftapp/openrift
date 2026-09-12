import type { ListIntent, ListKind } from "@openrift/shared/types/api/list";
import { WellKnown } from "@openrift/shared/well-known";

import type { DraftRule } from "@/features/rules/lib/rule-draft";
import { emptyDraft } from "@/features/rules/lib/rule-draft";
import { m } from "@/paraglide/messages.js";

/**
 * Presets are static definitions; DB-driven data like set slugs arrives here at apply time.
 */
interface RulePresetContext {
  languages?: string[];
  mainSetSlugs?: string[];
}

/**
 * A one-click starting point for the rule editor. Applying a preset only seeds
 * draft rules; nothing persists until the user hits Save.
 */
export interface RulePreset {
  id: string;
  label: string;
  description: string;
  build: (ctx?: RulePresetContext) => DraftRule[];
}

export function wishRulePresets(): RulePreset[] {
  return [
    {
      id: "one-of-everything",
      label: m.lists_rule_preset_one_of_everything_label(),
      description: m.lists_rule_preset_one_of_everything_description(),
      build: (ctx) => [
        {
          ...emptyDraft(ctx?.languages),
          quantity: { mode: "fixed", n: 1 },
          netOwned: true,
        },
      ],
    },
    {
      id: "playset-of-everything",
      label: m.lists_rule_preset_playset_of_everything_label(),
      description: m.lists_rule_preset_playset_of_everything_description(),
      build: (ctx) => [
        {
          ...emptyDraft(ctx?.languages),
          quantity: { mode: "playset", multiplier: 1 },
          netOwned: true,
        },
      ],
    },
    {
      id: "main-set-playsets",
      label: m.lists_rule_preset_main_set_playsets_label(),
      description: m.lists_rule_preset_main_set_playsets_description(),
      build: (ctx) => {
        const draft = emptyDraft(ctx?.languages);
        return [
          {
            ...draft,
            filter: {
              ...draft.filter,
              // Snapshot of the current main sets; a later-released set joins only
              // when the user re-applies the preset or edits the sets facet.
              sets: ctx?.mainSetSlugs ?? [],
              isStandard: true,
              // isStandard already excludes overnumbered prints; the explicit
              // flag keeps the rule intact if the user later turns standard off.
              isOvernumbered: false,
              typesExclude: [WellKnown.cardType.RUNE],
              superTypesExclude: [WellKnown.superType.TOKEN],
            },
            quantity: { mode: "playset", multiplier: 1 },
            netOwned: true,
            countSpecialVersions: true,
          },
        ];
      },
    },
  ];
}

export function tradeRulePresets(): RulePreset[] {
  return [
    {
      id: "keep-playset",
      label: m.lists_rule_preset_keep_playset_label(),
      description: m.lists_rule_preset_keep_playset_description(),
      build: (ctx) => [
        {
          ...emptyDraft(ctx?.languages),
          keepPerCard: { mode: "playset", multiplier: 1 },
          keepPer: "card",
        },
      ],
    },
    {
      id: "keep-one-per-card",
      label: m.lists_rule_preset_keep_one_per_card_label(),
      description: m.lists_rule_preset_keep_one_per_card_description(),
      build: (ctx) => [
        {
          ...emptyDraft(ctx?.languages),
          keepPerCard: { mode: "fixed", n: 1 },
          keepPer: "card",
        },
      ],
    },
    {
      id: "keep-one-per-printing",
      label: m.lists_rule_preset_keep_one_per_printing_label(),
      description: m.lists_rule_preset_keep_one_per_printing_description(),
      build: (ctx) => [
        {
          ...emptyDraft(ctx?.languages),
          keepPerCard: { mode: "fixed", n: 1 },
          keepPer: "printing",
        },
      ],
    },
  ];
}

export function organizeCardRulePresets(): RulePreset[] {
  return [
    {
      id: "organize-everything",
      label: m.lists_rule_preset_organize_everything_label(),
      description: m.lists_rule_preset_organize_everything_description(),
      build: (ctx) => [
        {
          ...emptyDraft(ctx?.languages),
          quantity: { mode: "fixed", n: 1 },
        },
      ],
    },
    {
      id: "organize-missing",
      label: m.lists_rule_preset_organize_missing_label(),
      description: m.lists_rule_preset_organize_missing_description(),
      build: (ctx) => [
        {
          ...emptyDraft(ctx?.languages),
          quantity: { mode: "fixed", n: 1 },
          netOwned: true,
        },
      ],
    },
  ];
}

export function organizeCopyRulePresets(): RulePreset[] {
  return [
    {
      id: "organize-all-copies",
      label: m.lists_rule_preset_organize_all_copies_label(),
      description: m.lists_rule_preset_organize_all_copies_description(),
      build: (ctx) => [
        {
          ...emptyDraft(ctx?.languages),
          keepPerCard: { mode: "fixed", n: 0 },
          keepPer: "card",
        },
      ],
    },
    {
      id: "organize-duplicates",
      label: m.lists_rule_preset_organize_duplicates_label(),
      description: m.lists_rule_preset_organize_duplicates_description(),
      build: (ctx) => [
        {
          ...emptyDraft(ctx?.languages),
          keepPerCard: { mode: "fixed", n: 1 },
          keepPer: "card",
        },
      ],
    },
  ];
}

export function rulePresetsFor(intent: ListIntent, kind: ListKind): RulePreset[] {
  if (intent === "organize") {
    return kind === "copy" ? organizeCopyRulePresets() : organizeCardRulePresets();
  }
  return kind === "copy" ? tradeRulePresets() : wishRulePresets();
}
