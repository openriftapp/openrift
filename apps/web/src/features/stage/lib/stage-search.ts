import type { DeckZone } from "@openrift/shared/types/enums";
import { z } from "zod/mini";

import { filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { queueCardsSearchSchema } from "@/features/stage/lib/presentation-queue-search";
import { lenient } from "@/lib/lenient-param";

const DECK_ZONES = [
  "main",
  "sideboard",
  "legend",
  "champion",
  "runes",
  "battlefield",
  "overflow",
] as const satisfies readonly DeckZone[];

// Carries the shared filter params on top of its own: dropping them would make a
// link copied from /cards fail validation, and leaving a queue show could not
// land back on the filtered view it was built from.
export const stageShowSearchSchema = z.extend(filterSearchSchema, {
  deck: lenient(z.string()),
  tier: lenient(z.string()),
  tierShare: lenient(z.string()),
  cards: queueCardsSearchSchema,
  zone: lenient(z.enum(DECK_ZONES)),
  i: lenient(z.number().check(z.int(), z.nonnegative())),
  mode: lenient(z.enum(["edit"])),
  preset: lenient(z.string()),
});

/** Keeps the show's params so older `/stage?deck=` links still validate on their way to the show. */
export const stageBuilderSearchSchema = z.extend(stageShowSearchSchema, {
  edit: lenient(z.boolean()),
});
