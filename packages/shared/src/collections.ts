export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function boundsOf(vals: number[]): { min: number; max: number } {
  if (vals.length === 0) {
    return { min: 0, max: 0 };
  }
  return {
    min: Math.floor(Math.min(...vals)),
    max: Math.ceil(Math.max(...vals)),
  };
}

export function mostCommonValue(items: string[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [val, count] of counts) {
    if (count > bestCount) {
      best = val;
      bestCount = count;
    }
  }
  return best;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`chunk size must be a positive integer, got ${size}`);
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function labelMap(rows: readonly { slug: string; label: string }[]): Record<string, string> {
  return Object.fromEntries(rows.map((row) => [row.slug, row.label]));
}
