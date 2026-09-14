import { isoDate } from "@openrift/shared/schemas";
import { z } from "zod";

import { META_CROSS_SOURCE_STATES } from "../../types/enums.js";

/**
 * Ranked hints only: nothing links automatically, since a wrong link would
 * fold two unrelated tournaments into one page.
 */
export const metaEventMatchSuggestionSchema = z.object({
  metaEventId: z.string(),
  slug: z.string(),
  name: z.string(),
  eventDate: isoDate,
  format: z.string(),
  playerRowCount: z.number().int().nonnegative(),
  score: z.number(),
  reasons: z.array(z.string()),
  isExact: z.boolean(),
});

export const metaPlayerMatchSuggestionSchema = z.object({
  metaEventPlayerId: z.string(),
  playerName: z.string(),
  rank: z.number().int(),
  rankIsTier: z.boolean(),
  deckId: z.string().nullable(),
  score: z.number(),
  reasons: z.array(z.string()),
  isCurrent: z.boolean(),
  isExact: z.boolean(),
});

/**
 * One standings row of a mirror the event cites but does not read, and the
 * live row the reviewer decided it is.
 */
export const metaCrossSourceRowSchema = z.object({
  provider: z.string(),
  sourceIdentity: z.string(),
  playerName: z.string(),
  rank: z.number().int(),
  legendName: z.string().nullable(),
  hasDeck: z.boolean(),
  state: z.enum(META_CROSS_SOURCE_STATES),
  metaEventPlayerId: z.string().nullable(),
  suggestions: z.array(metaPlayerMatchSuggestionSchema),
});

export const metaCrossSourceCitationSchema = z.object({
  id: z.string(),
  provider: z.string(),
  externalId: z.string(),
  contributes: z.boolean(),
});

export const metaCrossSourceReviewSchema = z.object({
  sources: z.array(metaCrossSourceCitationSchema),
  rows: z.array(metaCrossSourceRowSchema),
});
