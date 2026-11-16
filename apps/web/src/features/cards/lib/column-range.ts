export const MIN_COLUMNS = 1;
export const MAX_COLUMNS = 12;

export function clampColumns(columns: number): number {
  return Math.max(MIN_COLUMNS, Math.min(columns, MAX_COLUMNS));
}
