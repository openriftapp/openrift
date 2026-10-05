/**
 * Coercers for untyped JSON read from third-party APIs. Each returns `null`
 * for anything outside its shape, so a projection can drop or default a field.
 */

export function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Trimmed non-empty string; a finite number is stringified. */
export function text(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

export function count(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export function coord(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function sourceId(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

export function instant(value: unknown): Date | null {
  const raw = text(value);
  if (raw === null) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const MAX_RECORDED_ERRORS = 50;

export function recordCapped(
  errors: string[],
  messages: readonly string[],
  cap = MAX_RECORDED_ERRORS,
): void {
  for (const message of messages) {
    if (errors.length >= cap) {
      return;
    }
    errors.push(message);
  }
}
