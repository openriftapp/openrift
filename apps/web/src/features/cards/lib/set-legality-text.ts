import type { SetLegality } from "@openrift/shared/format-legality";

import { m } from "@/paraglide/messages.js";

/** Undefined while the card is legal. */
export function setLegalityText(legality: SetLegality): string | undefined {
  switch (legality.status) {
    case "legal": {
      return undefined;
    }
    case "rotated": {
      return m.card_detail_rotated_title({ date: legality.until });
    }
    case "upcoming": {
      return legality.from
        ? m.card_detail_legal_from({ date: legality.from })
        : m.card_detail_not_legal_yet();
    }
    case "outside": {
      return m.card_detail_not_in_legal_set();
    }
  }
}
