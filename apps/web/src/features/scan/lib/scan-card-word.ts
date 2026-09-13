import { m } from "@/paraglide/messages.js";

export function cardWord(count: number): string {
  return m.scan_card_word({ count });
}
