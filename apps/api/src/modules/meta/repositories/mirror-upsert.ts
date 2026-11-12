import { keyBatches, rowBatches } from "../../../lib/bind-batches.js";

interface MirrorUpsertResult<K> {
  inserted: K[];
  changed: K[];
  unchanged: K[];
}

interface MirrorUpsertSpec<T, K> {
  keyOf: (row: T) => K;
  write: (batch: T[]) => Promise<readonly { key: K; inserted: boolean }[]>;
  touch: (keys: K[]) => Promise<void>;
}

export function compareKeys<K extends string | number>(a: K, b: K): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Key order: two crawls writing the same rows in different orders deadlock on the
// row locks. A repeated key keeps its last row: one statement cannot update a row twice.
export async function upsertMirrorRows<T extends object, K extends string | number>(
  rows: readonly T[],
  spec: MirrorUpsertSpec<T, K>,
): Promise<MirrorUpsertResult<K>> {
  const byKey = new Map<K, T>();
  for (const row of rows) {
    byKey.set(spec.keyOf(row), row);
  }
  const ordered = [...byKey.entries()]
    .toSorted(([a], [b]) => compareKeys(a, b))
    .map(([, row]) => row);

  const inserted: K[] = [];
  const changed: K[] = [];
  for (const batch of rowBatches(ordered)) {
    for (const row of await spec.write(batch)) {
      (row.inserted ? inserted : changed).push(row.key);
    }
  }

  const written = new Set([...inserted, ...changed]);
  const unchanged = [...byKey.keys()].filter((key) => !written.has(key)).toSorted(compareKeys);
  for (const batch of keyBatches(unchanged)) {
    await spec.touch(batch);
  }
  return { inserted, changed, unchanged };
}
