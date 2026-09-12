import { formatDay } from "@openrift/shared/format-date";
import type { DeckListItemResponse } from "@openrift/shared/types/api/deck";

import { m } from "@/paraglide/messages.js";

export type DeckMetaPartKey = "box" | "missing" | "value" | "updated";

export interface DeckMetaPart {
  key: DeckMetaPartKey;
  text: string | null;
  inlineText?: string;
  warn?: boolean;
  title?: string;
}

export function deckBoxPart(boxName?: string | null): DeckMetaPart {
  return {
    key: "box",
    text: boxName ? m.decks_meta_in_box({ box: boxName }) : null,
    title: boxName ? m.decks_meta_stored_in_box({ box: boxName }) : undefined,
  };
}

// The card count is deliberately absent: like the hero, these surfaces
// carry the build figure on the format badge instead.
export function deckMetaParts(
  item: DeckListItemResponse,
  formatPrice: (cents: number) => string,
  boxName?: string | null,
): DeckMetaPart[] {
  const { deck, totalValueCents, missingCount } = item;
  const createdDate = formatDay(deck.createdAt);
  const updatedDate = formatDay(deck.updatedAt);

  return [
    deckBoxPart(boxName),
    {
      key: "missing",
      text: missingCount !== null && missingCount > 0 ? `${missingCount} missing` : null,
      warn: true,
    },
    {
      key: "value",
      text: totalValueCents !== null && totalValueCents > 0 ? formatPrice(totalValueCents) : null,
    },
    {
      key: "updated",
      text: updatedDate,
      inlineText: `updated ${updatedDate}`,
      title: updatedDate === createdDate ? undefined : `Created ${createdDate}`,
    },
  ];
}
