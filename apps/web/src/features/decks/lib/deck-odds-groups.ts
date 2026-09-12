import type { DeckOddsGroup } from "@openrift/shared/contracts/decks";
import { enumLabel } from "@openrift/shared/enum-label";
import { WellKnown } from "@openrift/shared/well-known";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { chanceToDraw, EARLY_DRAWS, OPENING_HAND_SIZE } from "@/features/decks/lib/deck-draw-odds";
import { m } from "@/paraglide/messages.js";

// Must match `deckOddsGroupSchema`'s shape exactly.
export type OddsGroupDef = DeckOddsGroup;

/** Picker section a preset sorts under. */
export type OddsGroupTheme = "curve" | "interaction" | "economy" | "card-types";

export const ODDS_GROUP_THEMES: readonly OddsGroupTheme[] = [
  "curve",
  "interaction",
  "economy",
  "card-types",
];

export function oddsGroupThemeLabel(theme: OddsGroupTheme): string {
  switch (theme) {
    case "curve": {
      return m.decks_odds_theme_curve();
    }
    case "interaction": {
      return m.decks_odds_theme_interaction();
    }
    case "economy": {
      return m.decks_odds_theme_economy();
    }
    case "card-types": {
      return m.decks_odds_theme_card_types();
    }
  }
}

export interface OddsGroupPreset extends OddsGroupDef {
  theme: OddsGroupTheme;
  core?: boolean;
}

export interface OddsGroupRow {
  key: string;
  label: string;
  copies: number;
  openingChance: number;
  earlyChance: number;
}

export type GroupCard = Pick<
  DeckBuilderCard,
  "zone" | "quantity" | "cardTypes" | "keywords" | "tags" | "energy" | "might" | "power"
>;

// A numeric condition never matches a card with a null stat: "2 or less
// energy" must not include cards with no cost at all.
export function cardMatchesOddsGroup(card: GroupCard, def: OddsGroupDef): boolean {
  if (def.types && !def.types.some((type) => card.cardTypes.includes(type))) {
    return false;
  }
  if (def.keywords && !def.keywords.some((keyword) => card.keywords.includes(keyword))) {
    return false;
  }
  if (def.tags && !def.tags.some((tag) => card.tags.includes(tag))) {
    return false;
  }
  if (def.energyMin !== undefined && (card.energy === null || card.energy < def.energyMin)) {
    return false;
  }
  if (def.energyMax !== undefined && (card.energy === null || card.energy > def.energyMax)) {
    return false;
  }
  if (def.mightMin !== undefined && (card.might === null || card.might < def.mightMin)) {
    return false;
  }
  if (def.powerMin !== undefined && (card.power === null || card.power < def.powerMin)) {
    return false;
  }
  return true;
}

const UNIT = WellKnown.cardType.UNIT;

export function oddsGroupPresets(
  cards: readonly GroupCard[],
  typeLabels: Record<string, string>,
): OddsGroupPreset[] {
  const presets: OddsGroupPreset[] = [
    // Turn-1 energy is 2 going first, 3 going second.
    {
      key: "turn-one-first-unit",
      label: m.decks_odds_preset_turn_one_first_unit(),
      theme: "curve",
      types: [UNIT],
      energyMax: 2,
      core: true,
    },
    {
      key: "turn-one-first",
      label: m.decks_odds_preset_turn_one_first(),
      theme: "curve",
      types: [UNIT, WellKnown.cardType.GEAR],
      energyMax: 2,
    },
    {
      key: "turn-one-second",
      label: m.decks_odds_preset_turn_one_second(),
      theme: "curve",
      types: [UNIT, WellKnown.cardType.GEAR],
      energyMax: 3,
    },
    {
      key: "turn-one-second-unit",
      label: m.decks_odds_preset_turn_one_second_unit(),
      theme: "curve",
      types: [UNIT],
      energyMax: 3,
    },
    {
      key: "two-cost-unit",
      label: m.decks_odds_preset_two_cost_unit(),
      theme: "curve",
      types: [UNIT],
      energyMin: 2,
      energyMax: 2,
    },
    {
      key: "three-cost-unit",
      label: m.decks_odds_preset_three_cost_unit(),
      theme: "curve",
      types: [UNIT],
      energyMin: 3,
      energyMax: 3,
    },
    { key: "top-end", label: m.decks_odds_preset_top_end(), theme: "curve", energyMin: 5 },
    {
      key: "combat-trick",
      label: m.decks_odds_preset_combat_trick(),
      theme: "interaction",
      types: ["spell"],
      keywords: ["Action", "Reaction"],
      core: true,
    },
    {
      key: "reaction-speed",
      label: m.decks_odds_preset_reaction_speed(),
      theme: "interaction",
      keywords: ["Reaction"],
    },
    {
      key: "surprise-threat",
      label: m.decks_odds_preset_surprise_threat(),
      theme: "interaction",
      types: [UNIT],
      keywords: ["Hidden", "Ambush"],
    },
    {
      key: "defensive-tool",
      label: m.decks_odds_preset_defensive_tool(),
      theme: "interaction",
      keywords: ["Deflect", "Shield", "Tank"],
    },
    {
      key: "aggro-enabler",
      label: m.decks_odds_preset_aggro_enabler(),
      theme: "interaction",
      types: [UNIT],
      keywords: ["Assault", "Ganking"],
    },
    {
      key: "disruption",
      label: m.decks_odds_preset_disruption(),
      theme: "interaction",
      keywords: ["Stun", "Burn"],
    },
    {
      key: "ramp",
      label: m.decks_odds_preset_ramp(),
      theme: "economy",
      keywords: ["Accelerate", "Add"],
    },
    {
      key: "death-value",
      label: m.decks_odds_preset_death_value(),
      theme: "economy",
      keywords: ["Deathknell"],
    },
    {
      key: "big-body",
      label: m.decks_odds_preset_big_body(),
      theme: "economy",
      types: [UNIT],
      mightMin: 5,
    },
    { key: "rune-payoff", label: m.decks_odds_preset_rune_payoff(), theme: "economy", powerMin: 2 },
  ];

  const mainCards = cards.filter((card) => card.zone === WellKnown.deckZone.MAIN);
  const presentTypes = [...new Set(mainCards.flatMap((card) => card.cardTypes))];
  for (const type of presentTypes) {
    presets.push({
      key: `type-${type}`,
      label: m.decks_odds_preset_any_type({ label: enumLabel(typeLabels, type) }),
      theme: "card-types",
      types: [type],
    });
  }

  return presets;
}

export function oddsGroupRow(cards: readonly GroupCard[], def: OddsGroupDef): OddsGroupRow {
  const mainCards = cards.filter((card) => card.zone === WellKnown.deckZone.MAIN);
  const deckSize = mainCards.reduce((sum, card) => sum + card.quantity, 0);
  const copies = mainCards
    .filter((card) => cardMatchesOddsGroup(card, def))
    .reduce((sum, card) => sum + card.quantity, 0);
  return {
    key: def.key,
    label: def.label,
    copies,
    openingChance: chanceToDraw(copies, deckSize, OPENING_HAND_SIZE),
    earlyChance: chanceToDraw(copies, deckSize, EARLY_DRAWS),
  };
}

export function isInformativeGroupRow(row: OddsGroupRow, deckSize: number): boolean {
  return row.copies > 0 && row.copies < deckSize;
}

const MAX_DEFAULT_GROUPS = 4;
const ADAPTIVE_MIN_COPIES = 5;
const ADAPTIVE_MIN_CHANCE = 0.2;
const ADAPTIVE_MAX_CHANCE = 0.9;

export function defaultOddsGroupKeys(
  cards: readonly GroupCard[],
  presets: readonly OddsGroupPreset[],
): string[] {
  const mainCards = cards.filter((card) => card.zone === WellKnown.deckZone.MAIN);
  const deckSize = mainCards.reduce((sum, card) => sum + card.quantity, 0);
  if (deckSize === 0) {
    return [];
  }
  const rows = new Map(presets.map((preset) => [preset.key, oddsGroupRow(cards, preset)]));
  const informative = (preset: OddsGroupPreset) => {
    const row = rows.get(preset.key);
    return row !== undefined && isInformativeGroupRow(row, deckSize);
  };

  const core = presets.filter((preset) => preset.core && informative(preset));
  const adaptive = presets
    .filter((preset) => !preset.core && informative(preset))
    .filter((preset) => {
      const row = rows.get(preset.key);
      return (
        row !== undefined &&
        row.copies >= ADAPTIVE_MIN_COPIES &&
        row.openingChance >= ADAPTIVE_MIN_CHANCE &&
        row.openingChance <= ADAPTIVE_MAX_CHANCE
      );
    })
    .toSorted((left, right) => {
      const leftDist = Math.abs((rows.get(left.key)?.openingChance ?? 1) - 0.5);
      const rightDist = Math.abs((rows.get(right.key)?.openingChance ?? 1) - 0.5);
      return leftDist - rightDist;
    })
    .slice(0, Math.max(0, MAX_DEFAULT_GROUPS - core.length));

  return [...core, ...adaptive].map((preset) => preset.key);
}
