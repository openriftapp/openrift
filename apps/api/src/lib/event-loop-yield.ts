import { setImmediate } from "node:timers/promises";

/**
 * Returns a function that resolves on the next macrotask once `budgetMs` of
 * synchronous work has passed since the previous yield, and immediately otherwise.
 */
export function createEventLoopYielder(
  budgetMs = 10,
  now: () => number = () => performance.now(),
): () => Promise<void> {
  let sliceStart = now();
  return async () => {
    if (now() - sliceStart < budgetMs) {
      return;
    }
    await setImmediate();
    sliceStart = now();
  };
}
