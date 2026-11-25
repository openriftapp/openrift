import { useCards } from "@/features/cards/hooks/use-cards";
import type { RuleCardJudge } from "@/features/decks/lib/deck-builder-card";
import { ruleCardJudge } from "@/features/decks/lib/deck-builder-card";
import { useViewerLegality } from "@/hooks/use-viewer-legality";

/** Judges deck cards by the viewer's play region instead of the snapshot taken when they were added. */
export function useRuleCardJudge(): RuleCardJudge {
  const { cardsById } = useCards();
  const legality = useViewerLegality();
  return ruleCardJudge(cardsById, legality);
}
