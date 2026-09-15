import { isoDateTime } from "@openrift/shared/schemas";
import { z } from "zod";

import { authedRoute } from "../_base.js";

const TAG = "Admin - Board States";

const BS = "/api/admin/v1/board-states";

export const adminBoardStateSchema = z.object({
  id: z.string(),
  title: z.string(),
  ownerName: z.string().nullable(),
  coreRulesVersion: z.string().nullable(),
  tournamentRulesVersion: z.string().nullable(),
  stepCount: z.number().int().nonnegative(),
  shareToken: z.string().nullable(),
  isFeatured: z.boolean(),
  updatedAt: isoDateTime,
});

/** Admin-gated by the mount, not enforced here. `shareToken` is null unless the board is shared. */
export const adminBoardStatesContract = {
  list: authedRoute
    .route({ method: "GET", path: BS, tags: [TAG] })
    .output(z.object({ items: z.array(adminBoardStateSchema) })),
  setFeatured: authedRoute
    .route({ method: "PUT", path: `${BS}/{id}/featured`, tags: [TAG] })
    .errors({
      NOT_FOUND: { message: "Board state not found" },
      BAD_REQUEST: { message: "Only a shared board state can be featured" },
    })
    .input(z.object({ id: z.uuid(), featured: z.boolean() }))
    .output(adminBoardStateSchema),
};

export type AdminBoardStatesContract = typeof adminBoardStatesContract;
export type AdminBoardState = z.infer<typeof adminBoardStateSchema>;
export interface AdminBoardStatesResponse {
  items: AdminBoardState[];
}
