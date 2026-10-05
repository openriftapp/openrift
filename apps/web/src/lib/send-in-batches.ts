import { chunk } from "@openrift/shared/collections";

/** Sends one batch at a time; a rejection stops the run, and earlier batches stay committed. */
export async function sendInBatches<T>(
  items: readonly T[],
  size: number,
  send: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (const batch of chunk(items, size)) {
    await send(batch);
  }
}
