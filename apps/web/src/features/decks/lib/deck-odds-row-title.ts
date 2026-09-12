import { m } from "@/paraglide/messages.js";

export function oddsRowTitle(label: string, inHand: number): string {
  if (inHand > 1) {
    return m.decks_odds_row_title_many({ label, count: inHand });
  }
  if (inHand === 1) {
    return m.decks_odds_row_title_one({ label });
  }
  return label;
}
