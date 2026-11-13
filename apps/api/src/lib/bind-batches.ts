import { chunk } from "@openrift/shared/collections";
/**
 * postgres.js refuses a statement binding more than 65534 parameters, so any
 * write whose row count comes from outside the request has to be split.
 */

export const MAX_BIND_PARAMETERS = 65_534;

const ROW_PARAMETER_BUDGET = 60_000;

const KEY_BATCH_SIZE = 1000;

/**
 * Kysely builds the column list from the union of the rows' keys and binds
 * every column for every row, skipping only a key `undefined` everywhere.
 */
function boundColumns(rows: readonly object[]): number {
  const columns = new Set<string>();
  for (const row of rows) {
    for (const [column, value] of Object.entries(row)) {
      if (value !== undefined) {
        columns.add(column);
      }
    }
  }
  return columns.size;
}

/**
 * Batching costs the write its single-statement atomicity unless the caller
 * runs the batches inside a transaction.
 */
export function rowBatches<T extends object>(rows: readonly T[]): T[][] {
  const columns = boundColumns(rows);
  if (columns === 0) {
    return rows.length === 0 ? [] : [[...rows]];
  }
  return chunk(rows, Math.max(1, Math.floor(ROW_PARAMETER_BUDGET / columns)));
}

/** Batching a read means one query per batch; the caller concatenates the results. */
export function keyBatches<T>(keys: readonly T[]): T[][] {
  return chunk(keys, KEY_BATCH_SIZE);
}
