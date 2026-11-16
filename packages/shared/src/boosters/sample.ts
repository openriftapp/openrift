import type { Random } from "../random.js";
import { pickOneUnique } from "../random.js";
import type { BoosterPrinting, ResolvedBooster, ResolvedOutcome, ResolvedSlot } from "./types.js";

interface BoosterPull {
  slot: string;
  outcome: string;
  printing: BoosterPrinting;
}

export interface BoosterPack {
  pulls: BoosterPull[];
}

interface Keyed {
  id: string;
  printing: BoosterPrinting;
}

function keyed(pool: readonly BoosterPrinting[]): Keyed[] {
  return pool.map((printing) => ({ id: printing.printingId, printing }));
}

function rollOutcome(
  rng: Random,
  slot: ResolvedSlot,
  cardIndex: number,
  fill: ResolvedOutcome,
): ResolvedOutcome {
  const roll = rng.next();
  let cursor = 0;
  for (const outcome of slot.outcomes) {
    if (outcome.fillsRest || outcome.perPack <= 0 || cardIndex < slot.count - outcome.cards) {
      continue;
    }
    cursor += outcome.perPack / outcome.cards;
    if (roll < cursor) {
      return outcome;
    }
  }
  return fill;
}

/** Real packs never repeat a printing, so each pull excludes printings already in the pack. */
export function openBoosterPack(booster: ResolvedBooster, rng: Random): BoosterPack {
  if (!booster.openable) {
    throw new Error(`${booster.slug} cannot open in ${booster.language}`);
  }
  const pulls: BoosterPull[] = [];
  const pulled = new Set<string>();
  const take = (outcome: ResolvedOutcome): void => {
    const { printing } = pickOneUnique(rng, keyed(outcome.pool), pulled);
    pulls.push({ slot: outcome.slot, outcome: outcome.slug, printing });
    pulled.add(printing.printingId);
  };
  for (const slot of booster.slots) {
    const fill = slot.outcomes.find((outcome) => outcome.fillsRest);
    if (!fill) {
      throw new Error(`Slot ${slot.slug} has no fill outcome`);
    }
    for (let cardIndex = 0; cardIndex < slot.count; cardIndex++) {
      take(rollOutcome(rng, slot, cardIndex, fill));
    }
  }
  return { pulls };
}

export function openBoosterPacks(booster: ResolvedBooster, rng: Random, n: number): BoosterPack[] {
  return Array.from({ length: n }, () => openBoosterPack(booster, rng));
}
