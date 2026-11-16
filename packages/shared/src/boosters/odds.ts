export interface BoosterFrequency {
  kind: "per" | "one-in";
  count: number;
}

function tidy(value: number): number {
  return value >= 20 ? Math.round(value) : Math.round(value * 10) / 10;
}

const PER_THRESHOLD = 0.5;

export function packFrequency(perPack: number): BoosterFrequency {
  return perPack >= PER_THRESHOLD
    ? { kind: "per", count: Math.round(perPack * 100) / 100 }
    : { kind: "one-in", count: tidy(1 / perPack) };
}

export function unitFrequency(perPack: number, packsPerUnit: number): BoosterFrequency {
  const perUnit = perPack * packsPerUnit;
  return perUnit >= PER_THRESHOLD
    ? { kind: "per", count: Math.round(perUnit * 10) / 10 }
    : { kind: "one-in", count: tidy(1 / perUnit) };
}
