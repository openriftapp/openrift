import { m } from "@/paraglide/messages.js";

export function formatProductCounts(cardTotal: number, printingCount: number): string {
  const cards =
    cardTotal === 1
      ? m.common_cards_one({ count: cardTotal })
      : m.common_cards_other({ count: cardTotal });
  if (cardTotal === printingCount) {
    return cards;
  }
  return m.products_count_with_unique({ cards, unique: printingCount });
}
