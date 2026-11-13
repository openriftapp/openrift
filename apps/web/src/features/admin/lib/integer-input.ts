const INTEGER_PATTERN = /^-?\d+$/u;

export function parseIntegerInput(text: string, min?: number): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  if (!INTEGER_PATTERN.test(trimmed)) {
    return undefined;
  }
  const value = Number(trimmed);
  return min !== undefined && value < min ? undefined : value;
}

export function parseIntegerFields<K extends string>(
  texts: Readonly<Record<K, string>>,
): Partial<Record<K, number>> | undefined {
  const values: Partial<Record<K, number>> = {};
  for (const key of Object.keys(texts) as K[]) {
    const parsed = parseIntegerInput(texts[key]);
    if (parsed === undefined) {
      return undefined;
    }
    if (parsed !== null) {
      values[key] = parsed;
    }
  }
  return values;
}
