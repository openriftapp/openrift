import { WellKnown } from "../well-known.js";
import { BOOSTERS } from "./definitions.js";
import {
  groupBoosterPrintings,
  inSlotOverlaps,
  resolveBooster,
  resolvedOutcomes,
} from "./resolve.js";
import type { BoosterPrinting, ResolvedBooster } from "./types.js";

interface BoosterLanguageAudit {
  booster: ResolvedBooster;
  total: number;
  inPools: number;
  markedOrChannel: number;
  oversizedOrProduct: number;
  unreached: BoosterPrinting[];
  acknowledged: BoosterPrinting[];
  exclusives: BoosterPrinting[];
  overlaps: ReturnType<typeof inSlotOverlaps>;
}

interface BoosterMissingCode {
  shortCode: string;
  slot: string;
  outcome: string;
  missingIn: string[];
}

interface BoosterAudit {
  languages: BoosterLanguageAudit[];
  missing: BoosterMissingCode[];
}

export function auditBooster(
  slug: string,
  printings: readonly BoosterPrinting[],
  productPrintingIds: ReadonlySet<string>,
): BoosterAudit | null {
  const definition = BOOSTERS[slug];
  if (!definition) {
    return null;
  }
  const isAcknowledged = (shortCode: string, language: string): boolean =>
    definition.acknowledged.some(
      (entry) => entry.shortCode === shortCode && entry.language === language,
    );
  const grouped = groupBoosterPrintings(printings);
  const languages = Object.keys(definition.languages).flatMap((language) => {
    const booster = resolveBooster(slug, language, grouped);
    const inSet = grouped.get(`${definition.set}|${language}`) ?? [];
    if (!booster || inSet.length === 0) {
      return [];
    }
    const pooled = new Set(
      resolvedOutcomes(booster).flatMap((outcome) => outcome.pool.map((p) => p.printingId)),
    );
    const marked = inSet.filter((p) => (p.hasMarker || p.hasChannel) && !pooled.has(p.printingId));
    const rest = inSet.filter((p) => !pooled.has(p.printingId) && !p.hasMarker && !p.hasChannel);
    const oversizedOrProduct = rest.filter(
      (p) => p.size !== WellKnown.cardSize.STANDARD || productPrintingIds.has(p.printingId),
    );
    const nothing = rest.filter((p) => !oversizedOrProduct.includes(p));
    return [
      {
        booster,
        total: inSet.length,
        inPools: pooled.size,
        markedOrChannel: marked.length,
        oversizedOrProduct: oversizedOrProduct.length,
        unreached: nothing.filter((p) => !isAcknowledged(p.shortCode, language)),
        acknowledged: nothing.filter((p) => isAcknowledged(p.shortCode, language)),
        exclusives: inSet.filter((p) => p.isPackExclusive),
        overlaps: inSlotOverlaps(booster),
      },
    ];
  });

  const codes = new Map<string, Map<string, Set<string>>>();
  for (const { booster } of languages) {
    for (const outcome of booster.slots.flatMap((slot) => slot.outcomes)) {
      const key = `${outcome.slot}|${outcome.slug}`;
      const byCode = codes.get(key) ?? new Map<string, Set<string>>();
      for (const printing of outcome.pool.filter((p) => !p.isPackExclusive)) {
        const present = byCode.get(printing.shortCode) ?? new Set<string>();
        present.add(booster.language);
        byCode.set(printing.shortCode, present);
      }
      codes.set(key, byCode);
    }
  }
  const allLanguages = languages.map(({ booster }) => booster.language);
  const missing: BoosterMissingCode[] = [];
  for (const [key, byCode] of codes) {
    const [slot = "", outcome = ""] = key.split("|");
    for (const [shortCode, present] of byCode) {
      const missingIn = allLanguages.filter(
        (language) => !present.has(language) && !isAcknowledged(shortCode, language),
      );
      if (missingIn.length > 0) {
        missing.push({ shortCode, slot, outcome, missingIn });
      }
    }
  }
  missing.sort((a, b) => a.shortCode.localeCompare(b.shortCode));
  return { languages, missing };
}
