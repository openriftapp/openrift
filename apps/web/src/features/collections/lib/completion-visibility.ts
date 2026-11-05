export function omitZeroCompletion<T extends { percent: number }>(entries: T[]): T[] {
  return entries.filter((entry) => entry.percent > 0);
}
