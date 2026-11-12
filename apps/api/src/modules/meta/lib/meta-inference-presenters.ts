import { zoneExpected } from "@openrift/shared/deck-zones";
import type { PublicDeckCardResponse } from "@openrift/shared/types/api/deck";
import type {
  MetaDeckInference,
  MetaInferenceNeighbour,
  MetaListShape,
} from "@openrift/shared/types/api/meta";
import type { DeckFormat } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import type {
  DeckInferenceRow,
  InferenceNeighbourRow,
  ListShapeRow,
} from "../repositories/meta-inferences.js";

export interface GuessedCardRow {
  cardId: string;
  zone: string;
  quantity: number;
  preferredPrintingId: null;
}

export function guessedCardRows(row: DeckInferenceRow): GuessedCardRow[] {
  const ids: [string | null, string][] = [
    [row.championCardId, WellKnown.deckZone.CHAMPION],
    [row.championAltCardId, WellKnown.deckZone.CHAMPION],
    [row.battlefieldCardId, WellKnown.deckZone.BATTLEFIELD],
  ];
  return ids.flatMap(([cardId, zone]) =>
    cardId === null ? [] : [{ cardId, zone, quantity: 1, preferredPrintingId: null }],
  );
}

function toNeighbour(row: InferenceNeighbourRow): MetaInferenceNeighbour {
  return {
    shareToken: row.shareToken,
    playerName: row.playerName,
    eventName: row.eventName,
    rank: row.rank,
    rankIsTier: row.rankIsTier,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    shared: row.shared,
    championCardId: row.championCardId,
    championName: row.championName,
    battlefieldNames: row.battlefieldNames,
  };
}

export function toMetaDeckInference(
  row: DeckInferenceRow,
  cards: readonly PublicDeckCardResponse[],
  guessed: readonly PublicDeckCardResponse[],
  alsoSeen: readonly { cardId: string; name: string; slug: string }[],
  format: DeckFormat,
): MetaDeckInference | null {
  const held = (zone: string) =>
    cards.filter((card) => card.zone === zone).reduce((sum, card) => sum + card.quantity, 0);
  const championOpen = held(WellKnown.deckZone.CHAMPION) === 0;
  const battlefieldCap = zoneExpected(WellKnown.deckZone.BATTLEFIELD, format) ?? 0;
  const heldBattlefields = new Set(
    cards.filter((card) => card.zone === WellKnown.deckZone.BATTLEFIELD).map((card) => card.cardId),
  );
  const battlefieldOpen = held(WellKnown.deckZone.BATTLEFIELD) < battlefieldCap;

  const champions = championOpen
    ? guessed.filter((card) => card.zone === WellKnown.deckZone.CHAMPION)
    : [];
  const battlefield = battlefieldOpen
    ? (guessed.find(
        (card) =>
          card.zone === WellKnown.deckZone.BATTLEFIELD && !heldBattlefields.has(card.cardId),
      ) ?? null)
    : null;
  if (champions.length === 0 && battlefield === null) {
    return null;
  }

  const alsoSeenIds = new Set(row.battlefieldAlsoCardIds);
  return {
    champions,
    championUnsure: champions.length > 1 || (champions.length > 0 && row.championUnsure),
    battlefield,
    alsoSeenBattlefields:
      battlefield === null
        ? []
        : alsoSeen
            .filter((card) => alsoSeenIds.has(card.cardId) && !heldBattlefields.has(card.cardId))
            .toSorted((a, b) => a.name.localeCompare(b.name)),
    championNeighbours:
      champions.length === 0
        ? []
        : row.neighbours
            .filter((neighbour) => neighbour.zone === "champion")
            .map((neighbour) => toNeighbour(neighbour)),
    battlefieldNeighbours:
      battlefield === null
        ? []
        : row.neighbours
            .filter((neighbour) => neighbour.zone === "battlefield")
            .map((neighbour) => toNeighbour(neighbour)),
  };
}

export function toMetaListShape(row: ListShapeRow): MetaListShape {
  const battlefieldCap =
    zoneExpected(WellKnown.deckZone.BATTLEFIELD, row.format as DeckFormat) ?? 0;
  return {
    format: row.format as DeckFormat,
    legend: row.legend,
    champion: row.champion,
    battlefield: row.battlefield,
    main: row.main,
    runes: row.runes,
    inferredChampion: row.guessedChampionCardId !== null && row.champion === 0,
    inferredBattlefield:
      row.guessedBattlefieldCardId !== null &&
      row.battlefield < battlefieldCap &&
      !row.battlefieldCardIds.includes(row.guessedBattlefieldCardId),
  };
}
