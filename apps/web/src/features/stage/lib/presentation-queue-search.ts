import { z } from "zod/mini";

import { MAX_QUEUE_LENGTH } from "@/features/stage/lib/presentation-queue";
import { lenient } from "@/lib/lenient-param";

/**
 * Do not replace with a `z.maxLength()` check: combined with `lenient`,
 * a failed check drops the whole queue, not just the excess.
 */
export const queueCardsSearchSchema = lenient(
  z.pipe(
    z.array(z.string()),
    z.transform((ids: string[]) => ids.slice(0, MAX_QUEUE_LENGTH)),
  ),
);

/** Clearing `edit` here is required: carrying it forward makes this button a no-op once a queue has been presented. */
export function startPresentingSearch<T extends object>(
  prev: T,
  ids: readonly string[],
): Omit<T, "cards" | "i" | "edit"> & { cards: string[]; i: number; edit: undefined } {
  return { ...prev, cards: [...ids], i: 0, edit: undefined };
}

export function queueDraftSearch<T extends object>(
  prev: T,
  ids: readonly string[],
): Omit<T, "cards"> & { cards: string[] | undefined } {
  return { ...prev, cards: ids.length > 0 ? [...ids] : undefined };
}
