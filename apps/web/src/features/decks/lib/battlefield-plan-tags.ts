import { zoneExpected } from "@openrift/shared/deck-zones";
import type { DeckFormat } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { m } from "@/paraglide/messages.js";

export interface BattlefieldPlanPicks {
  battlefieldGame1CardId: string | null;
  battlefieldFirstCardId: string | null;
  battlefieldSecondCardId: string | null;
  battlefieldCustom: boolean;
}

export interface BattlefieldPlanTag {
  rank: number;
  label: string;
}

export function battlefieldPlanTags(
  plan: BattlefieldPlanPicks | null | undefined,
  format: DeckFormat,
): Map<string, BattlefieldPlanTag> {
  const tags = new Map<string, BattlefieldPlanTag>();
  if (
    !plan ||
    plan.battlefieldCustom ||
    zoneExpected(WellKnown.deckZone.BATTLEFIELD, format) === 1
  ) {
    return tags;
  }
  const picks = [
    { cardId: plan.battlefieldGame1CardId, label: m.decks_plan_game_1() },
    { cardId: plan.battlefieldFirstCardId, label: m.decks_plan_going_first() },
    { cardId: plan.battlefieldSecondCardId, label: m.decks_plan_going_second() },
  ];
  for (const [rank, pick] of picks.entries()) {
    if (pick.cardId === null) {
      continue;
    }
    const existing = tags.get(pick.cardId);
    tags.set(
      pick.cardId,
      existing
        ? { rank: existing.rank, label: `${existing.label} · ${pick.label}` }
        : { rank, label: pick.label },
    );
  }
  return tags;
}

export function orderByBattlefieldPlan(
  cards: DeckBuilderCard[],
  tags: ReadonlyMap<string, BattlefieldPlanTag>,
): DeckBuilderCard[] {
  if (tags.size === 0) {
    return cards;
  }
  const rankOf = (card: DeckBuilderCard) => tags.get(card.cardId)?.rank ?? 3;
  return cards.toSorted((a, b) => rankOf(a) - rankOf(b));
}
