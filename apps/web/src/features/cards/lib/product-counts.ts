import { m } from "@/paraglide/messages.js";

export function formatProductCounts(cardTotal: number, printingCount: number): string {
  const cards = m.common_cards({ count: cardTotal });
  if (cardTotal === printingCount) {
    return cards;
  }
  return m.products_count_with_unique({ cards, unique: printingCount });
}
