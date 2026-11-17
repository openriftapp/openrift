import { z } from "zod";

import {
  playriftboundEventIdSchema,
  playriftboundSyncPayloadSchema,
} from "../playriftbound-sync.js";
import { authedRoute } from "./_base.js";
import { tournamentSummaryResponseSchema } from "./tournaments.js";

export const playriftboundSyncTargetsResponseSchema = z.object({
  items: z.array(tournamentSummaryResponseSchema),
  linkedIds: z.array(z.string()),
});

export const playriftboundSyncSchema = z.object({
  tournamentId: z.uuid(),
  payload: playriftboundSyncPayloadSchema,
});

export const playriftboundSyncResponseSchema = z.object({
  tournamentId: z.string(),
  participantsCreated: z.number().int().nonnegative(),
  participantsUpdated: z.number().int().nonnegative(),
  participantsLeft: z.number().int().nonnegative(),
  decksCreated: z.number().int().nonnegative(),
  decksUpdated: z.number().int().nonnegative(),
  decksUnchanged: z.number().int().nonnegative(),
  decksKept: z.number().int().nonnegative(),
  checksInvalidated: z.number().int().nonnegative(),
});

const TAG = "Tournaments";

export const tournamentPlayriftboundContract = {
  targets: authedRoute
    .route({
      method: "GET",
      path: "/api/v1/tournaments/playriftbound/{eventId}/targets",
      tags: [TAG],
      description:
        "Tournaments the caller manages that a playriftbound event can sync into, with the ones already linked to it.",
    })
    .input(z.object({ eventId: playriftboundEventIdSchema }))
    .output(playriftboundSyncTargetsResponseSchema),
  sync: authedRoute
    .route({
      method: "POST",
      path: "/api/v1/tournaments/playriftbound/sync",
      tags: [TAG],
      description:
        "Links the tournament to the playriftbound event and syncs its roster and submitted decks, read by the browser extension.",
    })
    .errors({
      NOT_FOUND: { message: "Tournament not found" },
      CONFLICT: { message: "The tournament cannot take this sync" },
      VALIDATION_ERROR: { status: 422, message: "Invalid sync payload" },
    })
    .input(playriftboundSyncSchema)
    .output(playriftboundSyncResponseSchema),
};

export type TournamentPlayriftboundContract = typeof tournamentPlayriftboundContract;
