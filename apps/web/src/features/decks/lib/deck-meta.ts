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

export interface BoxedDeck {
  deckId: string;
  deckName: string;
  boxName: string;
}

export function deckBoxPart(boxed: readonly BoxedDeck[], deckId: string): DeckMetaPart {
  const [first] = boxed;
  if (!first) {
    return { key: "box", text: null };
  }
  const boxCount = new Set(boxed.map((entry) => entry.boxName)).size;
  const onlySelf = boxed.length === 1 && first.deckId === deckId;
  return {
    key: "box",
    text:
      boxCount === 1
        ? m.decks_meta_in_box({ box: first.boxName })
        : m.decks_meta_in_boxes({ count: boxCount }),
    title: onlySelf
      ? m.decks_meta_stored_in_box({ box: first.boxName })
      : boxed
          .map((entry) => m.decks_meta_variant_in_box({ deck: entry.deckName, box: entry.boxName }))
          .join("\n"),
  };
}

// The card count is deliberately absent: like the hero, these surfaces
// carry the build figure on the format badge instead.
export function deckMetaParts(
  item: DeckListItemResponse,
  formatPrice: (cents: number) => string,
  boxed: readonly BoxedDeck[] = [],
): DeckMetaPart[] {
  const { deck, totalValueCents, unpricedCardCount, missingCount } = item;
  const valueText =
    totalValueCents !== null && totalValueCents > 0 ? formatPrice(totalValueCents) : null;
  const unpricedText =
    unpricedCardCount !== null && unpricedCardCount > 0
      ? m.common_unpriced({ count: unpricedCardCount })
      : null;
  const createdDate = formatDay(deck.createdAt);
  const updatedDate = formatDay(deck.updatedAt);

  return [
    deckBoxPart(boxed, deck.id),
    {
      key: "missing",
      text: missingCount !== null && missingCount > 0 ? `${missingCount} missing` : null,
      warn: true,
    },
    {
      key: "value",
      text: [valueText, unpricedText].filter((text) => text !== null).join(" ") || null,
    },
    {
      key: "updated",
      text: updatedDate,
      inlineText: m.decks_meta_updated({ date: updatedDate }),
      title: updatedDate === createdDate ? undefined : `Created ${createdDate}`,
    },
  ];
}
