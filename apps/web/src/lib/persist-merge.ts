/** Reads one persisted field; `undefined` keeps the store's current value. */
export type FieldPicker<T> = (value: unknown) => T | undefined;

export const pickBoolean: FieldPicker<boolean> = (value) =>
  typeof value === "boolean" ? value : undefined;

export const pickString: FieldPicker<string> = (value) =>
  typeof value === "string" ? value : undefined;

export const pickNumber: FieldPicker<number> = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** Drops non-string entries; a non-array keeps the current value. */
export const pickStringArray: FieldPicker<string[]> = (value) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : undefined;

export function pickEnum<T extends string>(allowed: readonly T[]): FieldPicker<T> {
  return (value) => (allowed.includes(value as T) ? (value as T) : undefined);
}

/** Drops unknown entries; an empty result (or a non-array) keeps the current value. */
export function pickEnumArray<T extends string>(allowed: readonly T[]): FieldPicker<T[]> {
  return (value) => {
    if (!Array.isArray(value)) {
      return;
    }
    const valid = value.filter((entry): entry is T => allowed.includes(entry as T));
    return valid.length > 0 ? valid : undefined;
  };
}

/**
 * A zustand `persist` `merge` that validates each listed field of the
 * persisted blob and keeps the current value for anything missing or invalid.
 */
export function mergeFields<S extends object>(spec: { [K in keyof S]?: FieldPicker<S[K]> }) {
  return (persisted: unknown, current: S): S => {
    if (typeof persisted !== "object" || persisted === null) {
      return current;
    }
    const raw = persisted as Record<string, unknown>;
    const next = { ...current };
    for (const key of Object.keys(spec) as (keyof S & string)[]) {
      const picked = spec[key]?.(raw[key]);
      if (picked !== undefined) {
        next[key] = picked;
      }
    }
    return next;
  };
}
