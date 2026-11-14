export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function upperMedian(values: readonly number[]): number | undefined {
  return values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
}
