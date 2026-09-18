import {
  deckCheckEntryStateSchema,
  metaOverlayStatusSchema,
} from "@openrift/shared/response-schemas";
import { withParams } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "./_base.js";

export const ARCHIVE_LIST_ELIGIBILITIES = [
  "ready",
  "unchecked",
  "no_consent",
  "no_name_consent",
  "withdrawn",
  "no_list",
] as const;

export const archiveListEligibilitySchema = z.enum(ARCHIVE_LIST_ELIGIBILITIES);

export const archiveListParticipantSchema = z.object({
  participantId: z.string(),
  displayName: z.string(),
  entryState: deckCheckEntryStateSchema.nullable(),
  eligibility: archiveListEligibilitySchema,
  unmatchedLines: z.number().int().nonnegative(),
  suggestedIdentity: z.string().nullable(),
});

export const archiveListStandingSchema = z.object({
  identity: z.string(),
  rank: z.number().int(),
  playerName: z.string().nullable(),
  wins: z.number().int().nullable(),
  losses: z.number().int().nullable(),
  draws: z.number().int().nullable(),
  sentStatus: metaOverlayStatusSchema.nullable(),
});

export const archiveListEventSchema = z.object({
  name: z.string(),
  startAt: z.string(),
  displayStatus: z.string(),
  playerCount: z.number().int().nullable(),
  storeName: z.string().nullable(),
  resultsFetchedAt: z.string().nullable(),
});

export const archiveListStateResponseSchema = z.object({
  uvsgamesEventId: z.string().nullable(),
  tournamentCompleted: z.boolean(),
  event: archiveListEventSchema.nullable(),
  metaEventSlug: z.string().nullable(),
  standings: z.array(archiveListStandingSchema),
  participants: z.array(archiveListParticipantSchema),
});

export const archiveListRefreshResponseSchema = z.object({
  outcome: z.enum(["fetched", "fresh", "not_found", "failed"]),
  state: archiveListStateResponseSchema,
});

export const archiveListSendSchema = z.object({
  links: z
    .array(
      z.object({
        participantId: z.uuid(),
        identity: z.string().min(1).max(40),
        force: z.boolean().optional().default(false),
      }),
    )
    .min(1)
    .max(1024),
});

export const archiveListSendResponseSchema = z.object({
  sent: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.array(
    z.object({
      participantId: z.string(),
      reason: z.enum(["settled", "unknown_standing", "not_eligible", "duplicate_standing"]),
    }),
  ),
});

export const uvsgamesEventSuggestionSchema = z.object({
  externalId: z.string(),
  name: z.string(),
  startAt: z.string(),
  storeName: z.string(),
});

export const uvsgamesEventSuggestionsResponseSchema = z.object({
  items: z.array(uvsgamesEventSuggestionSchema),
});

const TAG = "Tournaments";
const BASE = "/api/v1/tournaments/{id}";
const idParamSchema = z.object({ id: z.uuid() });

const notFound = { NOT_FOUND: { message: "Tournament not found" } };

export const tournamentArchiveListsContract = {
  state: authedRoute
    .route({ method: "GET", path: `${BASE}/archive-lists`, tags: [TAG] })
    .errors(notFound)
    .input(idParamSchema)
    .output(archiveListStateResponseSchema),
  refresh: authedRoute
    .route({ method: "POST", path: `${BASE}/archive-lists/refresh`, tags: [TAG] })
    .errors({ ...notFound, CONFLICT: { message: "No UVS Games event is linked" } })
    .input(idParamSchema)
    .output(archiveListRefreshResponseSchema),
  send: authedRoute
    .route({ method: "POST", path: `${BASE}/archive-lists/send`, tags: [TAG] })
    .errors({
      ...notFound,
      CONFLICT: { message: "The lists cannot be sent yet" },
    })
    .input(withParams(idParamSchema, archiveListSendSchema))
    .output(archiveListSendResponseSchema),
  uvsgamesSuggestions: authedRoute
    .route({ method: "GET", path: `${BASE}/uvsgames-suggestions`, tags: [TAG] })
    .errors(notFound)
    .input(idParamSchema)
    .output(uvsgamesEventSuggestionsResponseSchema),
};

export type TournamentArchiveListsContract = typeof tournamentArchiveListsContract;
