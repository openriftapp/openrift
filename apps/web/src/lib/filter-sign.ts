export type FilterSign = "include" | "exclude";

export interface SignedValues {
  included: string[];
  excluded: string[];
}

export interface SignedFilterBinding {
  sign: FilterSign | null;
  onSignedToggle: (value: string, sign: FilterSign) => void;
  onSignFlip: () => void;
}

/** Null for an empty dimension. A dimension with both lists filled reads as include. */
export function dimensionSign(
  included: readonly string[],
  excluded: readonly string[],
): FilterSign | null {
  if (included.length > 0) {
    return "include";
  }
  return excluded.length > 0 ? "exclude" : null;
}

export function toggleSignedValue(
  included: readonly string[],
  excluded: readonly string[],
  value: string,
  sign: FilterSign,
): SignedValues {
  const [list, other] = sign === "include" ? [included, excluded] : [excluded, included];
  const nextList = list.includes(value)
    ? list.filter((entry) => entry !== value)
    : [...list, value];
  const nextOther = other.filter((entry) => entry !== value);
  return sign === "include"
    ? { included: nextList, excluded: nextOther }
    : { included: nextOther, excluded: nextList };
}

/** Moves every value to the side opposite the current sign; a mixed dimension ends up excluded. */
export function flipSignedValues(
  included: readonly string[],
  excluded: readonly string[],
): SignedValues {
  if (dimensionSign(included, excluded) === "include") {
    return { included: [], excluded: [...new Set([...excluded, ...included])] };
  }
  return { included: [...excluded], excluded: [] };
}

interface SignedFilterActions<Key extends string> {
  toggleSignedFilter: (includeKey: Key, excludeKey: Key, value: string, sign: FilterSign) => void;
  flipSignedFilter: (includeKey: Key, excludeKey: Key) => void;
}

export function bindSignedFilter<Key extends string>(
  actions: SignedFilterActions<Key>,
  includeKey: Key,
  excludeKey: Key,
  included: readonly string[],
  excluded: readonly string[],
): SignedFilterBinding {
  return {
    sign: dimensionSign(included, excluded),
    onSignedToggle: (value, sign) =>
      actions.toggleSignedFilter(includeKey, excludeKey, value, sign),
    onSignFlip: () => actions.flipSignedFilter(includeKey, excludeKey),
  };
}

export function cycleFlag(state: boolean | null): boolean | null {
  if (state === null) {
    return true;
  }
  return state ? false : null;
}
