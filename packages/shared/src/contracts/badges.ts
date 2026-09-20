import { z } from "zod";

import { authedRoute } from "./_base.js";

/** `people` is distinct counterparties waiting on the viewer, pooled across groups. */
const tradeBadgeSchema = z.object({
  total: z.number().int().nonnegative(),
  people: z.number().int().nonnegative(),
  byGroup: z.array(
    z.object({
      groupId: z.string(),
      groupSlug: z.string(),
      count: z.number().int().nonnegative(),
      respondCount: z.number().int().nonnegative(),
      settleCount: z.number().int().nonnegative(),
    }),
  ),
});

/** One read behind every header badge, so the poll costs one request. */
export const badgesResponseSchema = z.object({
  trades: tradeBadgeSchema,
  loans: z.object({ total: z.number().int().nonnegative() }),
  groupRequests: z.object({ count: z.number().int().nonnegative() }),
});

const TAG = "Badges";

export const badgesContract = {
  get: authedRoute
    .route({ method: "GET", path: "/api/v1/badges", tags: [TAG] })
    .output(badgesResponseSchema),
};
