import type { Domain } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import type {
  DomainCombo,
  DomainCount,
  EnergyCostCount,
  PowerCount,
  TypeCount,
} from "@/features/collections/lib/stat-types";
import { comboKey, sortCombos } from "@/features/collections/lib/stat-types";

interface CardStatsEntry {
  quantity: number;
  domains: Domain[];
  cardTypes: readonly string[];
  energy: number | null | undefined;
  power: number | null | undefined;
}

export interface CardStats {
  domainDistribution: DomainCount[];
  energyCurve: EnergyCostCount[];
  energyCurveStacks: DomainCombo[];
  averageEnergy: number | null;
  powerCurve: PowerCount[];
  powerCurveStacks: DomainCombo[];
  averagePower: number | null;
  typeBreakdown: TypeCount[];
  typeBreakdownDomains: Domain[];
}

interface CardStatsOrders {
  domains: readonly string[];
  cardTypes: readonly string[];
}

export const DECK_SINGLETON_TYPES: ReadonlySet<string> = new Set([
  WellKnown.cardType.LEGEND,
  WellKnown.cardType.RUNE,
  WellKnown.cardType.BATTLEFIELD,
]);

const POWER_ZERO_TYPES: ReadonlySet<string> = new Set([
  WellKnown.cardType.UNIT,
  WellKnown.cardType.SPELL,
  WellKnown.cardType.GEAR,
]);

function powerOf(entry: CardStatsEntry): number | null {
  if (entry.power !== null && entry.power !== undefined) {
    return entry.power;
  }
  return entry.cardTypes.some((type) => POWER_ZERO_TYPES.has(type)) ? 0 : null;
}

function curve(
  entries: readonly CardStatsEntry[],
  valueOf: (entry: CardStatsEntry) => number | null,
  key: "energy" | "power",
  domainOrder: readonly string[],
): {
  points: Record<string, string | number>[];
  stacks: DomainCombo[];
  average: number | null;
} {
  const byCombo = new Map<number, Map<string, number>>();
  const comboSet = new Set<string>();
  let sum = 0;
  let count = 0;
  for (const entry of entries) {
    const value = valueOf(entry);
    if (value === null) {
      continue;
    }
    const combo = comboKey(entry.domains, domainOrder);
    comboSet.add(combo);
    let comboMap = byCombo.get(value);
    if (!comboMap) {
      comboMap = new Map();
      byCombo.set(value, comboMap);
    }
    comboMap.set(combo, (comboMap.get(combo) ?? 0) + entry.quantity);
    sum += value * entry.quantity;
    count += entry.quantity;
  }
  const stacks = sortCombos(comboSet, domainOrder);
  const values = [...byCombo.keys()];
  const points: Record<string, string | number>[] = [];
  if (values.length > 0) {
    const max = Math.max(...values);
    for (let value = Math.min(...values); value <= max; value++) {
      const comboMap = byCombo.get(value);
      const point: Record<string, string | number> = { [key]: String(value) };
      for (const stack of stacks) {
        point[stack.key] = comboMap?.get(stack.key) ?? 0;
      }
      points.push(point);
    }
  }
  return { points, stacks, average: count > 0 ? sum / count : null };
}

export function computeCardStats(
  entries: readonly CardStatsEntry[],
  orders: CardStatsOrders,
  excludedTypes: ReadonlySet<string> = new Set(),
): CardStats {
  const domainCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const domain of entry.domains) {
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + entry.quantity);
    }
  }
  const domainDistribution: DomainCount[] = orders.domains
    .filter((domain) => domainCounts.has(domain))
    .map((domain) => ({ domain: domain as Domain, count: domainCounts.get(domain) ?? 0 }));

  const energy = curve(entries, (entry) => entry.energy ?? null, "energy", orders.domains);
  const power = curve(entries, powerOf, "power", orders.domains);

  const typeByDomain = new Map<string, Map<Domain, number>>();
  const typeTotal = new Map<string, number>();
  for (const entry of entries) {
    for (const cardType of entry.cardTypes) {
      if (excludedTypes.has(cardType)) {
        continue;
      }
      let domainMap = typeByDomain.get(cardType);
      if (!domainMap) {
        domainMap = new Map();
        typeByDomain.set(cardType, domainMap);
      }
      for (const domain of entry.domains) {
        domainMap.set(domain, (domainMap.get(domain) ?? 0) + entry.quantity);
      }
      typeTotal.set(cardType, (typeTotal.get(cardType) ?? 0) + entry.quantity);
    }
  }
  const typeDomainSet = new Set<string>();
  for (const domainMap of typeByDomain.values()) {
    for (const domain of domainMap.keys()) {
      typeDomainSet.add(domain);
    }
  }
  const typeBreakdownDomains = orders.domains.filter((domain) =>
    typeDomainSet.has(domain),
  ) as Domain[];
  const typeBreakdown: TypeCount[] = orders.cardTypes
    .filter((type) => typeByDomain.has(type))
    .map((type) => {
      const domainMap = typeByDomain.get(type);
      const entry: TypeCount = { type, total: typeTotal.get(type) ?? 0 };
      for (const domain of typeBreakdownDomains) {
        entry[domain] = domainMap?.get(domain) ?? 0;
      }
      return entry;
    });

  return {
    domainDistribution,
    energyCurve: energy.points as EnergyCostCount[],
    energyCurveStacks: energy.stacks,
    averageEnergy: energy.average,
    powerCurve: power.points as PowerCount[],
    powerCurveStacks: power.stacks,
    averagePower: power.average,
    typeBreakdown,
    typeBreakdownDomains,
  };
}
