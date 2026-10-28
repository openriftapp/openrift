import type { SearchContext } from "./search-query/evaluate.js";

export type FilterCardsOptions = SearchContext;

export const EMPTY_STRINGS: readonly string[] = [];

export function orderIndex(order: readonly string[], value: string): number {
  const idx = order.indexOf(value);
  return idx === -1 ? Infinity : idx;
}

/** Running min/max in `boundsOf` semantics (floor/ceil, empty → 0/0). */
export interface BoundsAcc {
  min: number;
  max: number;
  any: boolean;
}

export function bumpBounds(acc: BoundsAcc, value: number): void {
  acc.any = true;
  if (value < acc.min) {
    acc.min = value;
  }
  if (value > acc.max) {
    acc.max = value;
  }
}

export function readBounds(acc: BoundsAcc): { min: number; max: number } {
  return acc.any ? { min: Math.floor(acc.min), max: Math.ceil(acc.max) } : { min: 0, max: 0 };
}
