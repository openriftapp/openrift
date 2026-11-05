import type { DomainCombo, EnergyCostCount } from "@/features/collections/lib/stat-types";
import type { GroupCard } from "@/features/decks/lib/deck-odds-groups";
import { oddsGroupPresets, oddsGroupRow } from "@/features/decks/lib/deck-odds-groups";

export function turnOnePlayChances(
  cards: readonly GroupCard[],
  typeLabels: Record<string, string>,
): { first: number; second: number } | null {
  const presets = oddsGroupPresets(cards, typeLabels);
  const first = presets.find((preset) => preset.key === "turn-one-first");
  const second = presets.find((preset) => preset.key === "turn-one-second");
  if (!first || !second) {
    return null;
  }
  return {
    first: oddsGroupRow(cards, first).openingChance,
    second: oddsGroupRow(cards, second).openingChance,
  };
}

export function energyCurveTotals(
  curve: readonly EnergyCostCount[],
  stacks: readonly DomainCombo[],
): { energy: string; count: number }[] {
  return curve.map((entry) => ({
    energy: entry.energy,
    count: stacks.reduce((sum, stack) => sum + Number(entry[stack.key] ?? 0), 0),
  }));
}
