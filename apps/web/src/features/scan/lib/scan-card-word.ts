import { m } from "@/paraglide/messages.js";

export function cardWord(count: number): string {
  return count === 1 ? m.scan_card_word_one() : m.scan_card_word_plural();
}
