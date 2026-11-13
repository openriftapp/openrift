import { legendDisplayName } from "@openrift/shared/card-name";
import type { Card, CardBan } from "@openrift/shared/types/catalog";
import { isBaseBanFormat } from "@openrift/shared/well-known";

import type { MetaDeckCardsByDeck } from "@/features/meta/lib/meta-deck-collection";

export interface MetaBanGroupCard {
  cardId: string;
  displayName: string;
  main: number;
  side: number;
}

export interface MetaBanGroup {
  formatId: string;
  formatName: string;
  /** UTC date. */
  bannedAt: string;
  inEffect: boolean;
  cards: MetaBanGroupCard[];
}

export type MetaDeckBanState = "banned" | "upcoming";

type BanCard = Pick<Card, "name" | "types" | "tags" | "bans" | "upcomingBans">;

function groupKey(ban: CardBan, inEffect: boolean): string {
  return `${inEffect ? 0 : 1}|${ban.bannedAt}|${ban.formatId}`;
}

/** Bans in effect first, then by date; decks without a banned or soon-banned card are left out. */
export function metaDeckBans(
  decks: MetaDeckCardsByDeck,
  cardsById: Readonly<Record<string, BanCard | undefined>>,
): Map<string, MetaBanGroup[]> {
  const byDeck = new Map<string, MetaBanGroup[]>();
  for (const [deckId, cards] of decks) {
    const groups = new Map<string, MetaBanGroup>();
    for (const cardId of new Set([...cards.main.keys(), ...cards.side.keys()])) {
      const card = cardsById[cardId];
      if (card === undefined) {
        continue;
      }
      const entry = {
        cardId,
        displayName: legendDisplayName(card),
        main: cards.main.get(cardId) ?? 0,
        side: cards.side.get(cardId) ?? 0,
      };
      const bans = [
        ...card.bans.map((ban) => ({ ban, inEffect: true })),
        ...card.upcomingBans.map((ban) => ({ ban, inEffect: false })),
      ];
      for (const { ban, inEffect } of bans) {
        const key = groupKey(ban, inEffect);
        const group = groups.get(key) ?? {
          formatId: ban.formatId,
          formatName: ban.formatName,
          bannedAt: ban.bannedAt,
          inEffect,
          cards: [],
        };
        group.cards.push(entry);
        groups.set(key, group);
      }
    }
    if (groups.size > 0) {
      byDeck.set(
        deckId,
        [...groups.entries()]
          .toSorted(([a], [b]) => a.localeCompare(b))
          .map(([, group]) => ({
            ...group,
            cards: group.cards.toSorted(
              (a, b) =>
                b.main + b.side - (a.main + a.side) || a.displayName.localeCompare(b.displayName),
            ),
          })),
      );
    }
  }
  return byDeck;
}

/** Set when every ban in that state is scoped to one mode, so the list stays legal elsewhere. */
export function soleModeBanFormat(
  groups: readonly MetaBanGroup[],
  inEffect: boolean,
): string | undefined {
  const matching = groups.filter((group) => group.inEffect === inEffect);
  const formats = new Set(matching.map((group) => group.formatId));
  if (formats.size !== 1 || matching.some((group) => isBaseBanFormat(group.formatId))) {
    return undefined;
  }
  return matching[0]?.formatName;
}

export function nextBanDate(groups: readonly MetaBanGroup[]): string | undefined {
  return groups
    .filter((group) => !group.inEffect)
    .map((group) => group.bannedAt)
    .toSorted()
    .at(0);
}

export interface MetaDeckCardBan {
  state: MetaDeckBanState;
  modeFormat?: string;
}

/** A card banned now outranks one banned later. */
export function metaDeckCardBanStates(
  groups: readonly MetaBanGroup[],
): Map<string, MetaDeckCardBan> {
  const byCard = new Map<string, MetaBanGroup[]>();
  for (const group of groups) {
    for (const card of group.cards) {
      byCard.set(card.cardId, [...(byCard.get(card.cardId) ?? []), group]);
    }
  }
  const states = new Map<string, MetaDeckCardBan>();
  for (const [cardId, cardGroups] of byCard) {
    const inEffect = cardGroups.some((group) => group.inEffect);
    states.set(cardId, {
      state: inEffect ? "banned" : "upcoming",
      modeFormat: soleModeBanFormat(cardGroups, inEffect),
    });
  }
  return states;
}
