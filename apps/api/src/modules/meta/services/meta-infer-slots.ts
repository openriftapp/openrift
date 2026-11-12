import { zoneExpected } from "@openrift/shared/deck-zones";
import type { DeckFormat } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import type { Repos } from "../../../deps.js";
import type { ChampionFacts } from "../lib/meta-chosen-champion.js";
import type { GroupDeck, PlannedInference } from "../lib/meta-slot-inference.js";
import { inferenceSignature, inferGroup } from "../lib/meta-slot-inference.js";
import type { InferenceCardRow } from "../repositories/meta-inferences.js";

export interface MetaInferSlotsResult {
  groups: number;
  guessed: number;
  written: number;
  removed: number;
}

function groupDecks(rows: readonly InferenceCardRow[]): GroupDeck[] {
  const decks = new Map<
    string,
    GroupDeck & { main: Map<string, number>; battlefieldCardIds: string[] }
  >();
  for (const row of rows) {
    let deck = decks.get(row.deckId);
    if (deck === undefined) {
      deck = {
        deckId: row.deckId,
        partial: row.listStatus === "partial",
        main: new Map(),
        championCardId: null,
        battlefieldCardIds: [],
      };
      decks.set(row.deckId, deck);
    }
    if (row.zone === WellKnown.deckZone.MAIN) {
      deck.main.set(row.cardId, (deck.main.get(row.cardId) ?? 0) + row.quantity);
    } else if (row.zone === WellKnown.deckZone.CHAMPION) {
      deck.championCardId = row.cardId;
    } else if (!deck.battlefieldCardIds.includes(row.cardId)) {
      deck.battlefieldCardIds.push(row.cardId);
    }
  }
  return [...decks.values()];
}

export async function inferMetaDeckSlots(repos: Repos): Promise<MetaInferSlotsResult> {
  const { metaInferences } = repos;
  const [factRows, groups, stored] = await Promise.all([
    metaInferences.championFacts(),
    metaInferences.inferenceGroups(),
    metaInferences.storedInferences(),
  ]);
  const facts = new Map<string, ChampionFacts>(factRows.map((row) => [row.id, row]));

  const planned: PlannedInference[] = [];
  for (const group of groups) {
    const expected = zoneExpected(WellKnown.deckZone.BATTLEFIELD, group.format as DeckFormat) ?? 0;
    const decks = groupDecks(await metaInferences.inferenceDecks(group.legendCardId, group.format));
    planned.push(...inferGroup(group.legendCardId, decks, facts, expected));
  }

  const before = new Map(stored.map((row) => [row.deckId, inferenceSignature(row)]));
  const written = planned.filter((row) => before.get(row.deckId) !== inferenceSignature(row));
  const kept = new Set(planned.map((row) => row.deckId));
  const removed = stored.filter((row) => !kept.has(row.deckId)).map((row) => row.deckId);
  if (written.length > 0 || removed.length > 0) {
    await metaInferences.replaceInferences(written, removed);
  }
  return {
    groups: groups.length,
    guessed: planned.length,
    written: written.length,
    removed: removed.length,
  };
}

export function isInferSlotsNoop(result: MetaInferSlotsResult): boolean {
  return result.written === 0 && result.removed === 0;
}
