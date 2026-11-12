import { copyLimitFor } from "@openrift/shared/deck-rules";

import type { ChampionFacts } from "./meta-chosen-champion.js";

export interface InferenceDeck {
  deckId: string;
  main: ReadonlyMap<string, number>;
  championCardId: string | null;
  battlefieldCardIds: readonly string[];
}

interface Postings {
  decks: Int32Array;
  quantities: Uint8Array;
}

export interface LegendIndex {
  decks: readonly InferenceDeck[];
  postings: ReadonlyMap<string, Postings>;
  scores: Int32Array;
  scored: { main: ReadonlyMap<string, number>; touched: number[] } | null;
}

export interface Neighbour {
  deck: InferenceDeck;
  shared: number;
}

export interface ChampionGuess {
  ranked: readonly string[];
  neighbours: readonly Neighbour[];
  unsure: boolean;
}

export interface BattlefieldGuess {
  top: string;
  alsoSeen: readonly string[];
  neighbours: readonly Neighbour[];
}

export const NEIGHBOUR_COUNT = 5;
export const MIN_NEIGHBOURS = 3;
export const UNSURE_VOTE_RATIO = 0.6;

export function buildLegendIndex(decks: readonly InferenceDeck[]): LegendIndex {
  const lists = new Map<string, { decks: number[]; quantities: number[] }>();
  decks.forEach((deck, index) => {
    for (const [cardId, quantity] of deck.main) {
      let list = lists.get(cardId);
      if (list === undefined) {
        list = { decks: [], quantities: [] };
        lists.set(cardId, list);
      }
      list.decks.push(index);
      list.quantities.push(quantity);
    }
  });
  const postings = new Map<string, Postings>();
  for (const [cardId, list] of lists) {
    postings.set(cardId, {
      decks: Int32Array.from(list.decks),
      quantities: Uint8Array.from(list.quantities),
    });
  }
  return { decks, postings, scores: new Int32Array(decks.length), scored: null };
}

function scoreTarget(index: LegendIndex, main: ReadonlyMap<string, number>): number[] {
  if (index.scored?.main === main) {
    return index.scored.touched;
  }
  const { scores } = index;
  for (const deckIndex of index.scored?.touched ?? []) {
    scores[deckIndex] = 0;
  }
  const touched: number[] = [];
  for (const [cardId, quantity] of main) {
    const list = index.postings.get(cardId);
    if (list === undefined) {
      continue;
    }
    for (let position = 0; position < list.decks.length; position++) {
      const deckIndex = list.decks[position] as number;
      const current = scores[deckIndex] ?? 0;
      if (current === 0) {
        touched.push(deckIndex);
      }
      scores[deckIndex] = current + Math.min(quantity, list.quantities[position] as number);
    }
  }
  index.scored = { main, touched };
  return touched;
}

function ranksAbove(a: Neighbour, b: Neighbour): boolean {
  return a.shared > b.shared || (a.shared === b.shared && a.deck.deckId < b.deck.deckId);
}

export function nearestDecks(
  index: LegendIndex,
  main: ReadonlyMap<string, number>,
  count: number,
  accept: (deck: InferenceDeck) => boolean,
): Neighbour[] {
  const touched = scoreTarget(index, main);
  const best: Neighbour[] = [];
  for (const deckIndex of touched) {
    const shared = index.scores[deckIndex] as number;
    const last = best.at(-1);
    if (best.length === count && last !== undefined && shared < last.shared) {
      continue;
    }
    const deck = index.decks[deckIndex];
    if (deck === undefined || !accept(deck)) {
      continue;
    }
    const candidate = { deck, shared };
    if (best.length === count && last !== undefined && !ranksAbove(candidate, last)) {
      continue;
    }
    let slot = best.length;
    while (slot > 0 && ranksAbove(candidate, best[slot - 1] as Neighbour)) {
      slot--;
    }
    best.splice(slot, 0, candidate);
    if (best.length > count) {
      best.pop();
    }
  }
  return best;
}

export function championCandidates(
  legendCardId: string,
  main: ReadonlyMap<string, number>,
  facts: ReadonlyMap<string, ChampionFacts>,
): Set<string> {
  const legendTags = new Set(facts.get(legendCardId)?.tags);
  const candidates = new Set<string>();
  if (legendTags.size === 0) {
    return candidates;
  }
  for (const [cardId, card] of facts) {
    if (!card.isChampion || !card.tags.some((tag) => legendTags.has(tag))) {
      continue;
    }
    if ((main.get(cardId) ?? 0) < copyLimitFor(card)) {
      candidates.add(cardId);
    }
  }
  return candidates;
}

function rankVotes(votes: ReadonlyMap<string, number>): [string, number][] {
  return [...votes].toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function guessChampion(
  index: LegendIndex,
  target: InferenceDeck,
  candidates: ReadonlySet<string>,
): ChampionGuess | null {
  if (candidates.size === 0) {
    return null;
  }
  const neighbours = nearestDecks(
    index,
    target.main,
    NEIGHBOUR_COUNT,
    (deck) =>
      deck.deckId !== target.deckId &&
      deck.championCardId !== null &&
      candidates.has(deck.championCardId),
  );
  if (neighbours.length < MIN_NEIGHBOURS) {
    return null;
  }
  const votes = new Map<string, number>();
  for (const { deck, shared } of neighbours) {
    const champion = deck.championCardId as string;
    votes.set(champion, (votes.get(champion) ?? 0) + shared);
  }
  const ranked = rankVotes(votes);
  const [leader, runnerUp] = ranked;
  const unsure =
    leader !== undefined && runnerUp !== undefined && runnerUp[1] >= leader[1] * UNSURE_VOTE_RATIO;
  return { ranked: ranked.map(([cardId]) => cardId), neighbours, unsure };
}

export function guessBattlefield(
  index: LegendIndex,
  target: InferenceDeck,
  expected: number,
): BattlefieldGuess | null {
  const known = new Set(target.battlefieldCardIds);
  const neighbours = nearestDecks(
    index,
    target.main,
    NEIGHBOUR_COUNT,
    (deck) => deck.deckId !== target.deckId && deck.battlefieldCardIds.length === expected,
  );
  if (neighbours.length < MIN_NEIGHBOURS) {
    return null;
  }
  const votes = new Map<string, number>();
  for (const { deck, shared } of neighbours) {
    for (const cardId of deck.battlefieldCardIds) {
      if (!known.has(cardId)) {
        votes.set(cardId, (votes.get(cardId) ?? 0) + shared);
      }
    }
  }
  const [top, ...rest] = rankVotes(votes).map(([cardId]) => cardId);
  if (top === undefined) {
    return null;
  }
  return { top, alsoSeen: rest.slice(0, 3), neighbours };
}

export const ACCURACY_SAMPLE = 100;
export const LEGEND_ACCURACY_FLOOR = 0.7;

export interface GroupDeck extends InferenceDeck {
  partial: boolean;
}

export interface PlannedInference {
  deckId: string;
  championCardId: string | null;
  championAltCardId: string | null;
  championUnsure: boolean;
  battlefieldCardId: string | null;
  battlefieldAlsoCardIds: string[];
  neighbours: { zone: "champion" | "battlefield"; neighbourDeckId: string; shared: number }[];
}

export function legendChampionAccuracy(
  index: LegendIndex,
  legendCardId: string,
  facts: ReadonlyMap<string, ChampionFacts>,
): number | null {
  const known = index.decks.filter((deck) => deck.championCardId !== null);
  const step = Math.max(1, Math.floor(known.length / ACCURACY_SAMPLE));
  let tried = 0;
  let hits = 0;
  for (let position = 0; position < known.length; position += step) {
    const deck = known[position] as InferenceDeck;
    const candidates = championCandidates(legendCardId, deck.main, facts);
    if (!candidates.has(deck.championCardId as string)) {
      continue;
    }
    const guess = guessChampion(index, deck, candidates);
    if (guess === null) {
      continue;
    }
    tried++;
    if (guess.ranked[0] === deck.championCardId) {
      hits++;
    }
  }
  return tried === 0 ? null : hits / tried;
}

export function inferGroup(
  legendCardId: string,
  decks: readonly GroupDeck[],
  facts: ReadonlyMap<string, ChampionFacts>,
  expectedBattlefields: number,
): PlannedInference[] {
  const targets = decks.filter(
    (deck) =>
      deck.partial &&
      (deck.championCardId === null || deck.battlefieldCardIds.length < expectedBattlefields),
  );
  if (targets.length === 0) {
    return [];
  }
  const index = buildLegendIndex(decks.filter((deck) => !deck.partial));
  let accuracy: number | null | undefined;
  const planned: PlannedInference[] = [];
  for (const deck of targets) {
    const row: PlannedInference = {
      deckId: deck.deckId,
      championCardId: null,
      championAltCardId: null,
      championUnsure: false,
      battlefieldCardId: null,
      battlefieldAlsoCardIds: [],
      neighbours: [],
    };
    if (deck.championCardId === null) {
      const champion = guessChampion(
        index,
        deck,
        championCandidates(legendCardId, deck.main, facts),
      );
      if (champion !== null) {
        accuracy ??= legendChampionAccuracy(index, legendCardId, facts);
        const unsure = champion.unsure || (accuracy !== null && accuracy < LEGEND_ACCURACY_FLOOR);
        row.championCardId = champion.ranked[0] ?? null;
        row.championAltCardId = unsure ? (champion.ranked[1] ?? null) : null;
        row.championUnsure = unsure;
        row.neighbours.push(
          ...champion.neighbours.map(({ deck: neighbour, shared }) => ({
            zone: "champion" as const,
            neighbourDeckId: neighbour.deckId,
            shared,
          })),
        );
      }
    }
    if (deck.battlefieldCardIds.length < expectedBattlefields) {
      const battlefield = guessBattlefield(index, deck, expectedBattlefields);
      if (battlefield !== null) {
        row.battlefieldCardId = battlefield.top;
        row.battlefieldAlsoCardIds = [...battlefield.alsoSeen];
        row.neighbours.push(
          ...battlefield.neighbours.map(({ deck: neighbour, shared }) => ({
            zone: "battlefield" as const,
            neighbourDeckId: neighbour.deckId,
            shared,
          })),
        );
      }
    }
    if (row.championCardId !== null || row.battlefieldCardId !== null) {
      planned.push(row);
    }
  }
  return planned;
}

export function inferenceSignature(row: PlannedInference): string {
  return JSON.stringify([
    row.championCardId,
    row.championAltCardId,
    row.championUnsure,
    row.battlefieldCardId,
    row.battlefieldAlsoCardIds,
    row.neighbours
      .toSorted((a, b) => a.zone.localeCompare(b.zone))
      .map((neighbour) => [neighbour.zone, neighbour.neighbourDeckId, neighbour.shared]),
  ]);
}
