import { WellKnown } from "../well-known.js";
import { BOOSTERS, boosterSlugForSet } from "./definitions.js";
import type {
  BoosterBasis,
  BoosterDefinition,
  BoosterPrinting,
  BoosterRow,
  ResolvedBooster,
  ResolvedOutcome,
  ResolvedSlot,
} from "./types.js";
import { BOOSTER_BASES } from "./types.js";

export function weakestBasis(...bases: BoosterBasis[]): BoosterBasis {
  return bases.reduce((weakest, basis) =>
    BOOSTER_BASES.indexOf(basis) > BOOSTER_BASES.indexOf(weakest) ? basis : weakest,
  );
}

function setLanguageKey(setSlug: string, language: string): string {
  return `${setSlug}|${language}`;
}

export function groupBoosterPrintings(
  printings: readonly BoosterPrinting[],
): Map<string, BoosterPrinting[]> {
  return Map.groupBy(printings, (p) => setLanguageKey(p.setSlug, p.language));
}

function isPrintingList(
  printings: readonly BoosterPrinting[] | ReadonlyMap<string, BoosterPrinting[]>,
): printings is readonly BoosterPrinting[] {
  return Array.isArray(printings);
}

function isInPacks(p: BoosterPrinting): boolean {
  return (
    p.size === WellKnown.cardSize.STANDARD && (p.isPackExclusive || (!p.hasMarker && !p.hasChannel))
  );
}

function resolveSlot(
  definition: BoosterDefinition,
  slotIndex: number,
  candidates: readonly BoosterPrinting[],
  cap: BoosterBasis,
): ResolvedSlot {
  const slot = definition.slots[slotIndex];
  if (!slot) {
    throw new Error(`No slot ${slotIndex}`);
  }
  const outcomes: ResolvedOutcome[] = slot.outcomes.map((outcome) => {
    const pool = candidates.filter((p) => outcome.matches(p));
    const rated = outcome.fillsRest !== true;
    return {
      slug: outcome.slug,
      slot: slot.slug,
      pool,
      perPack: rated && pool.length > 0 ? outcome.perPack : 0,
      bound: rated ? (outcome.bound ?? null) : null,
      basis: weakestBasis(outcome.basis, cap),
      fillsRest: !rated,
      cards: rated ? (outcome.cards ?? slot.count) : slot.count,
    };
  });
  const rated = outcomes.filter((outcome) => !outcome.fillsRest);
  const sharedTaken = rated.reduce((sum, outcome) => sum + outcome.perPack, 0);
  const contributing = rated.filter((outcome) => outcome.perPack > 0);
  for (const outcome of outcomes) {
    if (outcome.fillsRest) {
      outcome.perPack = slot.count - sharedTaken;
      outcome.basis = weakestBasis(outcome.basis, ...contributing.map((sibling) => sibling.basis));
    }
  }
  return { slug: slot.slug, count: slot.count, outcomes };
}

/**
 * `printings` may hold the whole catalog or only the booster's set; anything outside the set and
 * language is ignored. Pass a {@link groupBoosterPrintings} result to avoid rescanning.
 */
export function resolveBooster(
  slug: string,
  language: string,
  printings: readonly BoosterPrinting[] | ReadonlyMap<string, BoosterPrinting[]>,
): ResolvedBooster | null {
  const definition = BOOSTERS[slug];
  const languageEntry = definition?.languages[language];
  if (!definition || !languageEntry) {
    return null;
  }
  const inSetAndLanguage = isPrintingList(printings)
    ? printings.filter((p) => p.setSlug === definition.set && p.language === language)
    : (printings.get(setLanguageKey(definition.set, language)) ?? []);
  const cap = weakestBasis(definition.layoutBasis, languageEntry.basisCap ?? "official");
  const candidates = inSetAndLanguage.filter((p) => isInPacks(p));
  const slots = definition.slots.map((_, index) => resolveSlot(definition, index, candidates, cap));
  return {
    slug,
    set: definition.set,
    language,
    packsPerBox: languageEntry.packsPerBox,
    boxesPerCase: languageEntry.boxesPerCase,
    slots,
    openable: slots.every((slot) =>
      slot.outcomes.every((outcome) => !outcome.fillsRest || outcome.pool.length > 0),
    ),
  };
}

export function boosterRowsForPrinting(
  printings: readonly BoosterPrinting[],
  printingId: string,
): BoosterRow[] {
  const target = printings.find((p) => p.printingId === printingId);
  const slug = target ? boosterSlugForSet(target.setSlug) : undefined;
  if (!target || !slug) {
    return [];
  }
  const resolved = resolveBooster(slug, target.language, printings);
  return resolved?.openable ? (boosterRowsByPrinting([resolved]).get(printingId) ?? []) : [];
}

export function resolveAllBoosters(printings: readonly BoosterPrinting[]): ResolvedBooster[] {
  const grouped = groupBoosterPrintings(printings);
  return Object.entries(BOOSTERS).flatMap(([slug, definition]) =>
    Object.keys(definition.languages).flatMap((language) => {
      const resolved = resolveBooster(slug, language, grouped);
      return resolved?.openable ? [resolved] : [];
    }),
  );
}

export function resolvedOutcomes(booster: ResolvedBooster): ResolvedOutcome[] {
  return booster.slots.flatMap((slot) => slot.outcomes);
}

export function boosterRowsByPrinting(
  boosters: readonly ResolvedBooster[],
): Map<string, BoosterRow[]> {
  const rows = new Map<string, BoosterRow[]>();
  for (const booster of boosters) {
    for (const outcome of resolvedOutcomes(booster)) {
      if (outcome.perPack <= 0) {
        continue;
      }
      for (const printing of outcome.pool) {
        const row: BoosterRow = {
          printingId: printing.printingId,
          booster: booster.slug,
          slot: outcome.slot,
          outcome: outcome.slug,
          outcomePerPack: outcome.perPack,
          bound: outcome.bound,
          poolSize: outcome.pool.length,
          basis: outcome.basis,
          packsPerBox: booster.packsPerBox,
          boxesPerCase: booster.boxesPerCase,
        };
        const list = rows.get(printing.printingId);
        if (list) {
          list.push(row);
        } else {
          rows.set(printing.printingId, [row]);
        }
      }
    }
  }
  return rows;
}

export function inSlotOverlaps(
  booster: ResolvedBooster,
): { slot: string; outcomes: string[]; printing: BoosterPrinting }[] {
  return booster.slots.flatMap((slot) => {
    const outcomesById = new Map<string, { printing: BoosterPrinting; outcomes: string[] }>();
    for (const outcome of slot.outcomes) {
      for (const printing of outcome.pool) {
        const entry = outcomesById.get(printing.printingId) ?? { printing, outcomes: [] };
        entry.outcomes.push(outcome.slug);
        outcomesById.set(printing.printingId, entry);
      }
    }
    return [...outcomesById.values()]
      .filter((entry) => entry.outcomes.length > 1)
      .map((entry) => ({ slot: slot.slug, ...entry }));
  });
}
