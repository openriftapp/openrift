import { m } from "@/paraglide/messages.js";

export function oddsRowTitle(label: string, inHand: number): string {
  if (inHand === 0) {
    return label;
  }
  return m.decks_odds_row_title({ label, count: inHand });
}
